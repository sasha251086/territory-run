import { Injectable, Inject, forwardRef, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FeedService } from '../feed/feed.service';
import { DistrictService } from '../districts/district.service';

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
  ) {
    const results = [];
    for (const h3Index of h3Indices) {
      const ownerships = await this.prisma.cellOwnership.findMany({
        where: { h3Index },
        orderBy: { influence: 'desc' },
        include: { user: true },
      });

      if (ownerships.length === 0) {
        results.push({ h3Index, ownerId: null, influence: 0 });
        continue;
      }

      const top = ownerships[0];
      const previousOwnerId = previousOwnerByCell.get(h3Index) ?? null;
      const newOwnerId = top.userId;

      if (previousOwnerId !== newOwnerId) {
        await this.prisma.cellHistory.create({
          data: {
            h3Index,
            fromUserId: previousOwnerId,
            toUserId: newOwnerId,
          },
        });

        const previousNickname = previousOwnerId
          ? (
              await this.prisma.user.findUnique({
                where: { id: previousOwnerId },
                select: { nickname: true },
              })
            )?.nickname ?? null
          : null;

        await this.feedService.createEvent('cell_captured', newOwnerId, {
          h3Index,
          cellOwnerNickname: top.user.nickname,
          previousOwnerNickname: previousNickname,
          influence: top.influence,
          timestamp: new Date(),
        });
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
      orderBy: { influence: 'desc' },
      take: 1,
      include: { user: true },
    });
    return ownerships[0] || null;
  }

  async snapshotOwners(h3Indices: string[]): Promise<Map<string, string | null>> {
    const map = new Map<string, string | null>();
    for (const h3Index of h3Indices) {
      const owner = await this.getCurrentOwner(h3Index);
      map.set(h3Index, owner?.userId ?? null);
    }
    return map;
  }
}
