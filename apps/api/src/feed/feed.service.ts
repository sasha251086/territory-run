import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SIEGE_EVENT_COOLDOWN_MS } from '../common/constants';

@Injectable()
export class FeedService {
  constructor(private prisma: PrismaService) {}

  async getFeed(userId: string, page: number = 1, limit: number = 20, rivalsOnly = false) {
    const skip = (page - 1) * limit;

    let rivalIds: string[] = [];
    if (rivalsOnly) {
      const follows = await this.prisma.rivalFollow.findMany({
        where: { followerId: userId },
        select: { targetUserId: true },
      });
      rivalIds = follows.map((f) => f.targetUserId);
      if (rivalIds.length === 0) {
        return { items: [], total: 0, page, limit, totalPages: 0 };
      }
    }

    const where = rivalsOnly ? { userId: { in: rivalIds } } : {};

    const events = await this.prisma.event.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            nickname: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    });

    const total = await this.prisma.event.count({ where });

    return {
      items: events,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async createEvent(type: string, userId: string, payload: Prisma.InputJsonValue) {
    return this.prisma.event.create({
      data: {
        type,
        userId,
        payload,
      },
    });
  }

  async hasRecentSiegeEvent(
    ownerId: string,
    challengerUserId: string,
    h3Index: string,
  ): Promise<boolean> {
    const since = new Date(Date.now() - SIEGE_EVENT_COOLDOWN_MS);
    const existing = await this.prisma.event.findFirst({
      where: {
        type: 'cell_siege',
        userId: ownerId,
        createdAt: { gte: since },
        AND: [
          { payload: { path: ['h3Index'], equals: h3Index } },
          { payload: { path: ['challengerUserId'], equals: challengerUserId } },
        ],
      },
      select: { id: true },
    });
    return existing != null;
  }
}
