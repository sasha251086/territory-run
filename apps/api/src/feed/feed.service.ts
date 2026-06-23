import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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

  async createEvent(type: string, userId: string, payload: any) {
    return this.prisma.event.create({
      data: {
        type,
        userId,
        payload,
      },
    });
  }
}
