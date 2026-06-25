import { Injectable, Inject, forwardRef, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FeedService } from '../feed/feed.service';
import { DistrictService } from '../districts/district.service';
import { SIEGE_THRESHOLD } from '../common/constants';
import { rankCellOwnerships } from '../common/cell-ownership.util';

type OwnershipRow = {
  h3Index: string;
  userId: string;
  influence: number;
  lastActivityAt: Date;
  user: { nickname: string };
};

@Injectable()
export class OwnershipService {
  private readonly logger = new Logger(OwnershipService.name);

  constructor(
    private prisma: PrismaService,
    private feedService: FeedService,
    @Inject(forwardRef(() => DistrictService))
    private districtService: DistrictService,
  ) {}

  async recalculateOwners(
    h3Indices: string[],
    previousOwnerByCell: Map<string, string | null> = new Map(),
    options: { suppressCaptureFeed?: boolean } = {},
  ) {
    if (h3Indices.length === 0) {
      return [];
    }

    const allOwnerships = await this.prisma.cellOwnership.findMany({
      where: { h3Index: { in: h3Indices } },
      include: { user: true },
    });

    const ownershipsByCell = new Map<string, OwnershipRow[]>();
    for (const ownership of allOwnerships) {
      const list = ownershipsByCell.get(ownership.h3Index) ?? [];
      list.push(ownership);
      ownershipsByCell.set(ownership.h3Index, list);
    }
    for (const [h3Index, list] of ownershipsByCell) {
      ownershipsByCell.set(h3Index, rankCellOwnerships(list));
    }

    const previousOwnerIds = new Set<string>();
    for (const h3Index of h3Indices) {
      const previousOwnerId = previousOwnerByCell.get(h3Index) ?? null;
      if (previousOwnerId) {
        previousOwnerIds.add(previousOwnerId);
      }
    }

    const previousUsers =
      previousOwnerIds.size > 0
        ? await this.prisma.user.findMany({
            where: { id: { in: [...previousOwnerIds] } },
            select: { id: true, nickname: true },
          })
        : [];
    const nickById = new Map(previousUsers.map((user) => [user.id, user.nickname]));

    const results = [];

    for (const h3Index of h3Indices) {
      const ownerships = ownershipsByCell.get(h3Index) ?? [];

      if (ownerships.length === 0) {
        results.push({ h3Index, ownerId: null, influence: 0 });
        continue;
      }

      const top = ownerships[0];
      const previousOwnerId = previousOwnerByCell.get(h3Index) ?? null;
      const newOwnerId = top.userId;

      await this.maybeNotifySiege(h3Index, ownerships);

      if (previousOwnerId !== newOwnerId) {
        await this.prisma.cellHistory.create({
          data: {
            h3Index,
            fromUserId: previousOwnerId,
            toUserId: newOwnerId,
          },
        });

        const previousNickname = previousOwnerId
          ? (nickById.get(previousOwnerId) ?? null)
          : null;

        if (!options.suppressCaptureFeed && previousNickname) {
          await this.feedService.createEvent('cell_captured', newOwnerId, {
            h3Index,
            cellOwnerNickname: top.user.nickname,
            previousOwnerNickname: previousNickname,
            influence: top.influence,
            timestamp: new Date(),
          });
        }
        this.logger.log({
          msg: 'Cell captured',
          h3Index,
          newOwnerId,
          nickname: top.user.nickname,
        });
      }

      results.push({
        h3Index,
        ownerId: top.userId,
        influence: top.influence,
        user: top.user,
      });
    }

    await this.districtService.recalculateForCells(h3Indices);

    return results;
  }

  async getCurrentOwner(h3Index: string) {
    const ownerships = await this.prisma.cellOwnership.findMany({
      where: { h3Index },
      include: { user: true },
    });
    const ranked = rankCellOwnerships(ownerships);
    return ranked[0] || null;
  }

  async snapshotOwners(h3Indices: string[]): Promise<Map<string, string | null>> {
    const map = new Map<string, string | null>();
    for (const h3Index of h3Indices) {
      map.set(h3Index, null);
    }

    if (h3Indices.length === 0) {
      return map;
    }

    const ownerships = await this.prisma.cellOwnership.findMany({
      where: { h3Index: { in: h3Indices } },
      select: {
        h3Index: true,
        userId: true,
        influence: true,
        lastActivityAt: true,
      },
    });

    const ownershipsByCell = new Map<string, typeof ownerships>();
    for (const ownership of ownerships) {
      const list = ownershipsByCell.get(ownership.h3Index) ?? [];
      list.push(ownership);
      ownershipsByCell.set(ownership.h3Index, list);
    }

    for (const h3Index of h3Indices) {
      const ranked = rankCellOwnerships(ownershipsByCell.get(h3Index) ?? []);
      map.set(h3Index, ranked[0]?.userId ?? null);
    }

    return map;
  }

  private async maybeNotifySiege(
    h3Index: string,
    ownerships: {
      userId: string;
      influence: number;
      user: { nickname: string };
    }[],
  ) {
    if (ownerships.length < 2) {
      return;
    }

    const top = ownerships[0];
    const challenger = ownerships[1];

    if (top.userId === challenger.userId || top.influence <= 0) {
      return;
    }

    if (challenger.influence < top.influence * SIEGE_THRESHOLD) {
      return;
    }

    const hasRecent = await this.feedService.hasRecentSiegeEvent(
      top.userId,
      challenger.userId,
      h3Index,
    );
    if (hasRecent) {
      return;
    }

    const gapPercent = Math.round((challenger.influence / top.influence) * 100);

    await this.feedService.createEvent('cell_siege', top.userId, {
      h3Index,
      challengerUserId: challenger.userId,
      challengerNickname: challenger.user.nickname,
      challengerInfluence: challenger.influence,
      ownerInfluence: top.influence,
      gapPercent,
    });

    this.logger.log({
      msg: 'Cell siege warning',
      h3Index,
      ownerId: top.userId,
      challengerId: challenger.userId,
      gapPercent,
    });
  }
}
