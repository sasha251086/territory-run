import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class LeaderboardService {
  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
  ) {}

  async getTopByCells(limit: number = 100) {
    const cacheKey = `leaderboard:cells:${limit}`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const result = await this.prisma.userStats.findMany({
      where: { cellsOwned: { gt: 0 } },
      orderBy: { cellsOwned: 'desc' },
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            nickname: true,
            avatarUrl: true,
          },
        },
      },
    });

    const formatted = result.map((stat, index) => ({
      rank: index + 1,
      userId: stat.userId,
      nickname: stat.user.nickname,
      avatarUrl: stat.user.avatarUrl,
      value: stat.cellsOwned,
    }));

    await this.redisService.set(cacheKey, JSON.stringify(formatted), 60);
    return formatted;
  }

  async getTopByInfluence(limit: number = 100) {
    const cacheKey = `leaderboard:influence:${limit}`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const result = await this.prisma.userStats.findMany({
      where: { totalInfluence: { gt: 0 } },
      orderBy: { totalInfluence: 'desc' },
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            nickname: true,
            avatarUrl: true,
          },
        },
      },
    });

    const formatted = result.map((stat, index) => ({
      rank: index + 1,
      userId: stat.userId,
      nickname: stat.user.nickname,
      avatarUrl: stat.user.avatarUrl,
      value: Math.round(stat.totalInfluence * 100) / 100,
    }));

    await this.redisService.set(cacheKey, JSON.stringify(formatted), 60);
    return formatted;
  }

  async getTopByDistance(limit: number = 100) {
    const cacheKey = `leaderboard:distance:${limit}`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const result = await this.prisma.userStats.findMany({
      where: { totalDistance: { gt: 0 } },
      orderBy: { totalDistance: 'desc' },
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            nickname: true,
            avatarUrl: true,
          },
        },
      },
    });

    const formatted = result.map((stat, index) => ({
      rank: index + 1,
      userId: stat.userId,
      nickname: stat.user.nickname,
      avatarUrl: stat.user.avatarUrl,
      value: Number(stat.totalDistance),
    }));

    await this.redisService.set(cacheKey, JSON.stringify(formatted), 60);
    return formatted;
  }
}
