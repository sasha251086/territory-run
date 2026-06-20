import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FeedService } from '../feed/feed.service'; // <-- добавить

@Injectable()
export class OwnershipService {
  constructor(
    private prisma: PrismaService,
    private feedService: FeedService, // <-- добавить
  ) {}

  async recalculateOwners(h3Indices: string[]) {
    const results = [];
    for (const h3Index of h3Indices) {
      // Получаем текущего владельца (для сравнения)
      const currentOwner = await this.prisma.cellOwnership.findFirst({
        where: { h3Index },
        orderBy: { influence: 'desc' },
        include: { user: true },
      });

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
      const previousOwnerId = currentOwner?.userId || null;
      const newOwnerId = top.userId;

      // Если владелец изменился — создаём событие
      if (previousOwnerId !== newOwnerId) {
        await this.feedService.createEvent('cell_captured', newOwnerId, {
          h3Index,
          cellOwnerNickname: top.user.nickname,
          previousOwnerNickname: currentOwner?.user?.nickname || null,
          influence: top.influence,
          timestamp: new Date(),
        });
        console.log(`[Event] Cell ${h3Index} captured by ${top.user.nickname}`);
      }

      results.push({
        h3Index,
        ownerId: top.userId,
        influence: top.influence,
        user: top.user,
      });
    }
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
}