import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FeedService {
  constructor(private prisma: PrismaService) {}

  async getFeed(userId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const events = await this.prisma.event.findMany({
      where: {
        // Можно фильтровать по подпискам, но для MVP показываем все события
      },
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

    const total = await this.prisma.event.count();

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
