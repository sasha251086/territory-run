import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { MapQueryDto } from './dto/map-query.dto';
import {
  CaptureTargetDto,
  CellPlayersResponseDto,
  CellResponseDto,
  MapSummaryResponseDto,
} from './dto/cell-response.dto';
import { haversineDistance, isWithinBbox, roundCoord } from '../common/geo.util';
import {
  CAPTURE_TARGET_MAX_GAP,
  CAPTURE_TARGET_RADIUS_M,
  DECAY_THREAT_DAYS,
} from '../common/constants';
import {
  daysSinceActivity,
  decayRiskFor,
  runsToCapture,
} from '../common/cell-decay.util';

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

    const cacheKey = `map:bbox:${north}:${south}:${east}:${west}:${limit}:${userId}`;

    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const cells = await this.prisma.cell.findMany({
      include: {
        ownerships: {
          include: { user: true },
          orderBy: { influence: 'desc' },
        },
      },
    });

    const filtered = cells
      .filter((cell) => {
        const center = cell.center as { lat: number; lng: number } | null;
        if (!center) return false;
        return isWithinBbox(center.lat, center.lng, north, south, east, west);
      })
      .slice(0, limit);

    const h3Indices = filtered.map((c) => c.h3Index);
    const myOwnerships = await this.prisma.cellOwnership.findMany({
      where: { userId, h3Index: { in: h3Indices } },
    });
    const myByCell = new Map(myOwnerships.map((o) => [o.h3Index, o]));

    const result = filtered.map((cell) =>
      this.toCellDto(cell, myByCell.get(cell.h3Index), cell.ownerships, userId),
    );

    await this.redisService.set(cacheKey, JSON.stringify(result), 45);
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

    return ownerships.map((ownership) =>
      this.toCellDto(ownership.cell, ownership, ownership.cell.ownerships, userId),
    );
  }

  async getCellPlayers(h3Index: string, userId: string): Promise<CellPlayersResponseDto> {
    const ownerships = await this.prisma.cellOwnership.findMany({
      where: { h3Index },
      orderBy: { influence: 'desc' },
      include: { user: true },
    });

    const allRanked = ownerships.map((o, index) => ({
      rank: index + 1,
      userId: o.userId,
      nickname: o.user.nickname,
      influence: o.influence,
      isMe: o.userId === userId,
    }));

    const myIndex = ownerships.findIndex((o) => o.userId === userId);
    const myOwnership = myIndex >= 0 ? ownerships[myIndex] : null;
    const leader = ownerships[0];
    const isOwner = leader?.userId === userId;
    const myInfluence = myOwnership?.influence ?? 0;
    const leaderInfluence = leader?.influence ?? 0;
    const gapToLeader = isOwner ? 0 : Math.max(0, leaderInfluence - myInfluence);
    const second = ownerships[1];

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
      runsToCapture: runsToCapture(gapToLeader),
      isOwner,
      leadOverNext:
        isOwner && second ? Math.max(0, myInfluence - second.influence) : null,
      totalPlayers: ownerships.length,
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

    for (const mine of myOwnerships) {
      const center = mine.cell.center as { lat: number; lng: number } | null;
      if (!center) continue;

      const distance = haversineDistance(lat, lng, center.lat, center.lng);
      if (distance > CAPTURE_TARGET_RADIUS_M) continue;

      const leader = mine.cell.ownerships[0];
      if (!leader || leader.userId === userId) continue;

      const gap = leader.influence - mine.influence;
      if (gap <= 0 || gap > CAPTURE_TARGET_MAX_GAP) continue;

      targets.push({
        h3Index: mine.h3Index,
        lat: center.lat,
        lng: center.lng,
        myInfluence: mine.influence,
        leaderInfluence: leader.influence,
        gap,
        runsNeeded: runsToCapture(gap),
        ownerNickname: leader.user.nickname,
      });
    }

    targets.sort((a, b) => a.gap - b.gap);

    const message =
      targets.length === 0
        ? 'Рядом нет клеток, которые можно захватить за 1–3 пробежки.'
        : `${targets.length} клеток рядом — нужна ${targets[0].runsNeeded <= 1 ? '1 пробежка' : `~${targets[0].runsNeeded} пробежки`}.`;

    return { targets, message };
  }

  async getMapSummary(userId: string): Promise<MapSummaryResponseDto> {
    const h3Module = await import('h3-js');
    const h3 = h3Module.default || h3Module;
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
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { stats: true },
    });
    if (user?.homeLat != null && user.homeLng != null) {
      const { targets } = await this.getCaptureTargets(userId, user.homeLat, user.homeLng);
      captureTargetsNearby = targets.length;
    }

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const cellsGainedThisWeek = await this.prisma.event.count({
      where: {
        userId,
        type: 'cell_captured',
        createdAt: { gte: weekAgo },
      },
    });

    const cellsOwned = user?.stats?.cellsOwned ?? 0;
    const territoryAreaM2 = cellsOwned * cellAreaM2;
    const weeklyGoal = Math.max(5, Math.ceil(cellsOwned * 0.08));
    const weeklyProgressPercent = Math.min(
      100,
      Math.round((cellsGainedThisWeek / weeklyGoal) * 100),
    );

    return {
      cellsAtRisk,
      captureTargetsNearby,
      territoryAreaM2,
      cellsGainedThisWeek,
      weeklyProgressPercent,
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

  private toCellDto(
    cell: {
      h3Index: string;
      center: unknown;
      ownerships: OwnershipWithUser[];
    },
    myOwnership: { userId: string; influence: number; lastActivityAt: Date } | undefined,
    ownerships: OwnershipWithUser[],
    userId: string,
  ): CellResponseDto {
    const topOwner = ownerships[0];
    const center = cell.center as { lat: number; lng: number } | null;
    const myInfluence = myOwnership?.influence;
    const myLastActivityAt = myOwnership?.lastActivityAt ?? null;
    const isOwner = topOwner?.userId === userId;

    let gapToLeader: number | undefined;
    let runsNeeded: number | undefined;
    let myRank: number | null | undefined;

    if (myOwnership) {
      const rankIndex = ownerships.findIndex((o) => o.userId === userId);
      myRank = rankIndex >= 0 ? rankIndex + 1 : null;

      if (!isOwner && topOwner) {
        gapToLeader = Math.max(0, topOwner.influence - myOwnership.influence);
        runsNeeded = runsToCapture(gapToLeader);
      }
    }

    return {
      h3Index: cell.h3Index,
      ownerId: topOwner?.userId || null,
      ownerNickname: topOwner?.user?.nickname || null,
      influence: topOwner?.influence || 0,
      lastActivityAt: topOwner?.lastActivityAt || null,
      lat: center?.lat ?? null,
      lng: center?.lng ?? null,
      myInfluence,
      myLastActivityAt,
      daysSinceMyActivity: daysSinceActivity(myLastActivityAt),
      decayRisk: myOwnership ? decayRiskFor(myLastActivityAt) : 'none',
      isOwner: myOwnership ? isOwner : false,
      gapToLeader,
      runsToCapture: runsNeeded,
      myRank,
      totalPlayers: ownerships.length,
    };
  }
}
