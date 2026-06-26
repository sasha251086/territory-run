import { Injectable } from '@nestjs/common';
import * as h3 from 'h3-js';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { MapQueryDto } from './dto/map-query.dto';
import {
  CaptureTargetDto,
  CellPlayersResponseDto,
  CellResponseDto,
  MapSummaryResponseDto,
} from './dto/cell-response.dto';
import { haversineDistance, roundCoord } from '../common/geo.util';
import {
  CAPTURE_TARGET_EXPAND_LIMIT,
  CAPTURE_TARGET_FINISH_GAP,
  CAPTURE_TARGET_MAX_GAP,
  CAPTURE_TARGET_RADIUS_M,
  DECAY_THREAT_DAYS,
  SIEGE_THRESHOLD,
} from '../common/constants';
import {
  daysSinceActivity,
  decayRiskFor,
  runsToCapture,
} from '../common/cell-decay.util';
import { estimateInfluencePerRun, describeInfluenceGain } from '../common/influence-gain.util';
import {
  getCellContestState,
  rankCellOwnerships,
} from '../common/cell-ownership.util';

type OwnershipWithUser = {
  userId: string;
  influence: number;
  lastActivityAt: Date;
  user: { nickname: string };
};

@Injectable()
export class MapService {
  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
  ) {}

  async getCells(query: MapQueryDto, userId: string): Promise<CellResponseDto[]> {
    const limit = Number(query.limit) || 1000;
    const north = roundCoord(query.north);
    const south = roundCoord(query.south);
    const east = roundCoord(query.east);
    const west = roundCoord(query.west);

    const cacheKey = `map:bbox:${north}:${south}:${east}:${west}:${limit}`;

    const cached = await this.redisService.get(cacheKey);
    let baseCells: Array<{
      h3Index: string;
      center: unknown;
      ownerships: OwnershipWithUser[];
    }>;

    if (cached) {
      baseCells = this.reviveCachedCells(JSON.parse(cached));
    } else {
      baseCells = await this.prisma.cell.findMany({
        where: {
          centerLat: { gte: south, lte: north },
          centerLng: { gte: west, lte: east },
        },
        take: limit,
        include: {
          ownerships: {
            include: { user: true },
            orderBy: { influence: 'desc' },
          },
        },
      });

      await this.redisService.set(cacheKey, JSON.stringify(baseCells), 45);
    }

    const perRun = await this.influencePerRunForUser(userId);

    const result = baseCells.map((cell) =>
      this.toCellDto(cell, cell.ownerships, userId, perRun),
    );

    return result;
  }

  async getMyCells(userId: string): Promise<CellResponseDto[]> {
    const ownerships = await this.prisma.cellOwnership.findMany({
      where: { userId },
      include: {
        cell: {
          include: {
            ownerships: {
              include: { user: true },
              orderBy: { influence: 'desc' },
            },
          },
        },
      },
    });

    const perRun = await this.influencePerRunForUser(userId);

    return ownerships.map((ownership) =>
      this.toCellDto(ownership.cell, ownership.cell.ownerships, userId, perRun),
    );
  }

  async getCellPlayers(h3Index: string, userId: string): Promise<CellPlayersResponseDto> {
    const perRun = await this.influencePerRunForUser(userId);
    const ownerships = await this.prisma.cellOwnership.findMany({
      where: { h3Index },
      include: { user: true },
    });

    const ranked = rankCellOwnerships(ownerships);
    const leader = ranked[0];
    const second = ranked[1];
    const contest = getCellContestState(leader?.influence ?? 0, second?.influence ?? 0);

    const allRanked = ranked.map((o, index) => ({
      rank: index + 1,
      userId: o.userId,
      nickname: o.user.nickname,
      influence: o.influence,
      isMe: o.userId === userId,
    }));

    const myIndex = ranked.findIndex((o) => o.userId === userId);
    const myOwnership = myIndex >= 0 ? ranked[myIndex] : null;
    const isOwner = leader?.userId === userId;
    const myInfluence = myOwnership?.influence ?? 0;
    const leaderInfluence = leader?.influence ?? 0;
    const gapToLeader = isOwner ? 0 : Math.max(0, leaderInfluence - myInfluence);

    const historyRows = await this.prisma.cellHistory.findMany({
      where: { h3Index },
      orderBy: { changedAt: 'desc' },
      take: 3,
    });

    const userIds = new Set<string>();
    for (const row of historyRows) {
      if (row.fromUserId) userIds.add(row.fromUserId);
      userIds.add(row.toUserId);
    }
    const users = await this.prisma.user.findMany({
      where: { id: { in: [...userIds] } },
      select: { id: true, nickname: true },
    });
    const nickById = new Map(users.map((u) => [u.id, u.nickname]));

    return {
      h3Index,
      players: allRanked.slice(0, 5),
      myInfluence,
      myRank: myIndex >= 0 ? myIndex + 1 : null,
      leaderInfluence,
      gapToLeader,
      runsToCapture: runsToCapture(gapToLeader, perRun),
      isOwner,
      leadOverNext:
        isOwner && second ? Math.max(0, myInfluence - second.influence) : null,
      contested: contest.contested,
      contestGap: contest.contested ? contest.contestGap : null,
      tiedOnInfluence: contest.tiedOnInfluence,
      challengerNickname: contest.contested ? second?.user.nickname ?? null : null,
      history: historyRows.map((row) => ({
        fromNickname: row.fromUserId ? nickById.get(row.fromUserId) ?? null : null,
        toNickname: nickById.get(row.toUserId) ?? 'Игрок',
        changedAt: row.changedAt,
      })),
    };
  }

  async getCaptureTargets(
    userId: string,
    lat: number,
    lng: number,
  ): Promise<{ targets: CaptureTargetDto[]; message: string }> {
    const perRun = await this.influencePerRunForUser(userId);
    const myOwnerships = await this.prisma.cellOwnership.findMany({
      where: { userId },
      include: {
        cell: {
          include: {
            ownerships: { orderBy: { influence: 'desc' }, include: { user: true } },
          },
        },
      },
    });

    const targets: CaptureTargetDto[] = [];
    const seen = new Set<string>();

    const pushTarget = (target: CaptureTargetDto) => {
      if (seen.has(target.h3Index)) {
        return;
      }
      seen.add(target.h3Index);
      targets.push(target);
    };

    for (const mine of myOwnerships) {
      const center = mine.cell.center as { lat: number; lng: number } | null;
      if (!center) continue;

      const distance = haversineDistance(lat, lng, center.lat, center.lng);
      if (distance > CAPTURE_TARGET_RADIUS_M) continue;

      const ranked = rankCellOwnerships(mine.cell.ownerships);
      const leader = ranked[0];
      const challenger = ranked[1];
      if (!leader) continue;

      const isOwner = leader.userId === userId;

      if (isOwner && challenger) {
        const contest = getCellContestState(leader.influence, challenger.influence);
        const underSiege = challenger.influence >= leader.influence * SIEGE_THRESHOLD;
        if (contest.contested || underSiege) {
          pushTarget({
            h3Index: mine.h3Index,
            lat: center.lat,
            lng: center.lng,
            myInfluence: leader.influence,
            leaderInfluence: challenger.influence,
            gap: Math.max(0, leader.influence - challenger.influence),
            runsNeeded: runsToCapture(
              Math.max(0, challenger.influence - leader.influence + 1),
              perRun,
            ),
            ownerNickname: challenger.user.nickname,
            category: 'defend',
          });
        }
        continue;
      }

      if (!isOwner) {
        const gap = leader.influence - mine.influence;
        if (gap <= 0 || gap > CAPTURE_TARGET_MAX_GAP) {
          continue;
        }

        const category: CaptureTargetDto['category'] =
          gap <= CAPTURE_TARGET_FINISH_GAP ? 'finish' : 'capture';

        pushTarget({
          h3Index: mine.h3Index,
          lat: center.lat,
          lng: center.lng,
          myInfluence: mine.influence,
          leaderInfluence: leader.influence,
          gap,
          runsNeeded: runsToCapture(gap, perRun),
          ownerNickname: leader.user.nickname,
          category,
        });
      }
    }

    await this.appendExpandTargets(userId, lat, lng, seen, targets, pushTarget, perRun);

    const categoryOrder = { defend: 0, finish: 1, capture: 2, expand: 3 };
    targets.sort((a, b) => {
      const orderDiff = categoryOrder[a.category] - categoryOrder[b.category];
      if (orderDiff !== 0) {
        return orderDiff;
      }
      return a.gap - b.gap;
    });

    const defendCount = targets.filter((target) => target.category === 'defend').length;
    const finishCount = targets.filter((target) => target.category === 'finish').length;
    const captureCount = targets.filter((target) => target.category === 'capture').length;

    const expandCount = targets.filter((target) => target.category === 'expand').length;

    let message = 'Рядом нет клеток для захвата — пробегитесь по новому маршруту.';
    if (targets.length > 0) {
      const parts: string[] = [];
      if (defendCount > 0) {
        parts.push(`${defendCount} защитить`);
      }
      if (finishCount > 0) {
        parts.push(`${finishCount} добить`);
      }
      if (captureCount > 0) {
        parts.push(`${captureCount} захватить`);
      }
      if (expandCount > 0) {
        parts.push(`${expandCount} расширить`);
      }
      message = `Рядом: ${parts.join(', ')}.`;
    }

    return { targets, message };
  }

  async getMapSummary(userId: string): Promise<MapSummaryResponseDto> {
    const cellAreaM2 = h3.getHexagonAreaAvg(9, 'm2');

    const myOwnerships = await this.prisma.cellOwnership.findMany({
      where: { userId },
      select: { lastActivityAt: true },
    });

    const cellsAtRisk = myOwnerships.filter((o) => {
      const days = daysSinceActivity(o.lastActivityAt);
      return days != null && days >= DECAY_THREAT_DAYS;
    }).length;

    let captureTargetsNearby = 0;
    let missions: MapSummaryResponseDto['missions'] = [];
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { stats: true },
    });
    if (user?.homeLat != null && user.homeLng != null) {
      const { targets } = await this.getCaptureTargets(userId, user.homeLat, user.homeLng);
      captureTargetsNearby = targets.length;
      missions = this.buildMissionHints(targets);
    }

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const cellsGainedAgg = await this.prisma.activity.aggregate({
      where: {
        userId,
        status: 'completed',
        processedAt: { gte: weekAgo },
      },
      _sum: { cellsCaptured: true },
    });
    const cellsGainedThisWeek = cellsGainedAgg._sum.cellsCaptured ?? 0;

    const cellsOwned = user?.stats?.cellsOwned ?? 0;
    const territoryAreaM2 = cellsOwned * cellAreaM2;
    const weeklyGoal = Math.max(5, Math.ceil(cellsOwned * 0.08));
    const weeklyProgressPercent = Math.min(
      100,
      Math.round((cellsGainedThisWeek / weeklyGoal) * 100),
    );

    const influenceGain = user
      ? describeInfluenceGain({
          homeLat: user.homeLat,
          homeLng: user.homeLng,
          createdAt: user.createdAt,
          currentStreak: user.stats?.currentStreak ?? 0,
          cellsOwned,
          assumeHomeZone: true,
        })
      : null;

    return {
      cellsAtRisk,
      captureTargetsNearby,
      territoryAreaM2,
      cellsGainedThisWeek,
      weeklyProgressPercent,
      missions,
      influencePerRun: influenceGain?.perRun ?? 1,
      effectiveInfluenceMultiplier: influenceGain?.effectiveMultiplier ?? 1,
      influenceMultiplierCapped: influenceGain?.multiplierCapped ?? false,
      atSoftCap: influenceGain?.atSoftCap ?? false,
    };
  }

  async getRivalCells(userId: string): Promise<
    Array<{ h3Index: string; targetUserId: string; nickname: string; lat: number; lng: number }>
  > {
    const follows = await this.prisma.rivalFollow.findMany({
      where: { followerId: userId },
      include: { target: { select: { id: true, nickname: true } } },
    });

    if (follows.length === 0) return [];

    const targetIds = follows.map((f) => f.targetUserId);
    const ownerships = await this.prisma.cellOwnership.findMany({
      where: { userId: { in: targetIds } },
      include: { cell: true },
    });

    const nickById = new Map(follows.map((f) => [f.targetUserId, f.target.nickname]));

    return ownerships
      .map((o) => {
        const center = o.cell.center as { lat: number; lng: number } | null;
        if (!center) return null;
        return {
          h3Index: o.h3Index,
          targetUserId: o.userId,
          nickname: nickById.get(o.userId) ?? 'Соперник',
          lat: center.lat,
          lng: center.lng,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);
  }

  private reviveCachedCells(
    cells: Array<{
      h3Index: string;
      center: unknown;
      ownerships: OwnershipWithUser[];
    }>,
  ) {
    return cells.map((cell) => ({
      ...cell,
      ownerships: cell.ownerships.map((ownership) => ({
        ...ownership,
        influence: Number(ownership.influence),
        lastActivityAt:
          ownership.lastActivityAt instanceof Date
            ? ownership.lastActivityAt
            : new Date(ownership.lastActivityAt),
      })),
    }));
  }

  private toCellDto(
    cell: {
      h3Index: string;
      center: unknown;
      centerLat?: number | null;
      centerLng?: number | null;
      ownerships: OwnershipWithUser[];
    },
    ownerships: OwnershipWithUser[],
    userId: string,
    effectiveGainPerRun = 1,
  ): CellResponseDto {
    const ranked = rankCellOwnerships(ownerships);
    const topOwner = ranked[0];
    const second = ranked[1];
    const contest = getCellContestState(topOwner?.influence ?? 0, second?.influence ?? 0);
    const center = cell.center as { lat: number; lng: number } | null;
    const myOwnership = ranked.find((o) => o.userId === userId);
    const myInfluence = myOwnership?.influence;
    const myLastActivityAt = myOwnership?.lastActivityAt ?? null;
    const isOwner = topOwner?.userId === userId;

    let gapToLeader: number | undefined;
    let runsNeeded: number | undefined;
    let myRank: number | null | undefined;

    if (myOwnership) {
      const rankIndex = ranked.findIndex((o) => o.userId === userId);
      myRank = rankIndex >= 0 ? rankIndex + 1 : null;

      if (!isOwner && topOwner) {
        gapToLeader = Math.max(0, topOwner.influence - myOwnership.influence);
        runsNeeded = runsToCapture(gapToLeader, effectiveGainPerRun);
      }
    }

    const involvedInContest =
      contest.contested &&
      myOwnership != null &&
      (isOwner || (myInfluence ?? 0) > 0);

    return {
      h3Index: cell.h3Index,
      ownerId: topOwner?.userId || null,
      ownerNickname: topOwner?.user?.nickname || null,
      influence: topOwner?.influence || 0,
      lastActivityAt: topOwner?.lastActivityAt || null,
      lat: center?.lat ?? cell.centerLat ?? null,
      lng: center?.lng ?? cell.centerLng ?? null,
      myInfluence,
      myLastActivityAt,
      daysSinceMyActivity: daysSinceActivity(myLastActivityAt),
      decayRisk: myOwnership ? decayRiskFor(myLastActivityAt) : 'none',
      isOwner: myOwnership ? isOwner : false,
      gapToLeader,
      runsToCapture: runsNeeded,
      myRank,
      contested: involvedInContest,
      contestGap: involvedInContest ? contest.contestGap : undefined,
      challengerNickname:
        involvedInContest && isOwner ? second?.user.nickname ?? null : undefined,
    };
  }

  private async influencePerRunForUser(userId: string): Promise<number> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { stats: true },
    });
    if (!user) {
      return 1;
    }
    return estimateInfluencePerRun({
      homeLat: user.homeLat,
      homeLng: user.homeLng,
      createdAt: user.createdAt,
      currentStreak: user.stats?.currentStreak ?? 0,
      cellsOwned: user.stats?.cellsOwned ?? 0,
      assumeHomeZone: true,
    });
  }

  private buildMissionHints(
    targets: CaptureTargetDto[],
  ): Array<{ category: CaptureTargetDto['category']; label: string; count: number }> {
    const labels: Record<CaptureTargetDto['category'], string> = {
      defend: 'Защити территорию',
      finish: 'Добей захват',
      capture: 'Захвати клетки',
      expand: 'Расширь границу',
    };
    const counts = { defend: 0, finish: 0, capture: 0, expand: 0 };
    for (const target of targets) {
      counts[target.category] += 1;
    }
    return (Object.keys(counts) as CaptureTargetDto['category'][])
      .filter((key) => counts[key] > 0)
      .map((category) => ({
        category,
        label: labels[category],
        count: counts[category],
      }));
  }

  private async appendExpandTargets(
    userId: string,
    lat: number,
    lng: number,
    seen: Set<string>,
    targets: CaptureTargetDto[],
    pushTarget: (target: CaptureTargetDto) => void,
    perRun: number,
  ) {
    if (targets.filter((t) => t.category === 'expand').length >= CAPTURE_TARGET_EXPAND_LIMIT) {
      return;
    }

    const origin = h3.latLngToCell(lat, lng, 9);
    const ring = h3.gridDisk(origin, 2);
    const myIndices = new Set(
      (
        await this.prisma.cellOwnership.findMany({
          where: { userId },
          select: { h3Index: true },
        })
      ).map((row) => row.h3Index),
    );

    const candidates = ring.filter((h3Index) => !seen.has(h3Index) && !myIndices.has(h3Index));
    if (candidates.length === 0) {
      return;
    }

    const cells = await this.prisma.cell.findMany({
      where: { h3Index: { in: candidates } },
      include: {
        ownerships: { orderBy: { influence: 'desc' }, include: { user: true } },
      },
    });

    const cellByH3 = new Map(cells.map((cell) => [cell.h3Index, cell]));

    for (const h3Index of candidates) {
      if (targets.filter((t) => t.category === 'expand').length >= CAPTURE_TARGET_EXPAND_LIMIT) {
        break;
      }

      const [cellLat, cellLng] = h3.cellToLatLng(h3Index);
      if (haversineDistance(lat, lng, cellLat, cellLng) > CAPTURE_TARGET_RADIUS_M) {
        continue;
      }

      const cell = cellByH3.get(h3Index);
      const ranked = rankCellOwnerships(cell?.ownerships ?? []);
      const leader = ranked[0];

      if (!leader) {
        pushTarget({
          h3Index,
          lat: cellLat,
          lng: cellLng,
          myInfluence: 0,
          leaderInfluence: 0,
          gap: 1,
          runsNeeded: runsToCapture(1, perRun),
          ownerNickname: null,
          category: 'expand',
        });
        continue;
      }

      if (leader.userId === userId) {
        continue;
      }

      pushTarget({
        h3Index,
        lat: cellLat,
        lng: cellLng,
        myInfluence: 0,
        leaderInfluence: leader.influence,
        gap: leader.influence + 1,
        runsNeeded: runsToCapture(leader.influence + 1, perRun),
        ownerNickname: leader.user.nickname,
        category: 'expand',
      });
    }
  }
}
