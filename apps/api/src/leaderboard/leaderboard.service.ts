import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

const REGIONAL_CACHE_TTL_SECONDS = 120;
const REGIONAL_DEFAULT_RADIUS_KM = 5;
const REGIONAL_TOP_LIMIT = 20;

type RegionalRow = {
  userId: string;
  nickname: string;
  avatarUrl: string | null;
  cellsOwned: number;
  distanceKm: number;
};

export type RegionalLeaderboardEntry = {
  rank: number;
  userId: string;
  nickname: string;
  avatarUrl: string | null;
  value: number;
  distanceKm: number;
};

export type RegionalLeaderboardResult = {
  noHomeBase: boolean;
  items: RegionalLeaderboardEntry[];
};

export type SeasonLeaderboardEntry = {
  rank: number;
  userId: string;
  nickname: string;
  avatarUrl: string | null;
  value: number;
  seasonInfluence: number;
};

export type SeasonLeaderboardResult = {
  season: {
    number: number;
    startDate: string;
    endDate: string;
    daysLeft: number;
  } | null;
  items: SeasonLeaderboardEntry[];
};

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

  async getRegionalLeaderboard(
    userId: string,
    radiusKm: number = REGIONAL_DEFAULT_RADIUS_KM,
  ): Promise<RegionalLeaderboardResult> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { homeLat: true, homeLng: true },
    });

    if (user?.homeLat == null || user?.homeLng == null) {
      return { noHomeBase: true, items: [] };
    }

    const lat = user.homeLat;
    const lng = user.homeLng;
    const h3Module = await import('h3-js');
    const regionKey = h3Module.latLngToCell(lat, lng, 5);
    const cacheKey = `leaderboard:regional:${regionKey}:${Math.round(radiusKm * 10)}`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as RegionalLeaderboardResult;
    }

    const rows = (await this.prisma.$queryRaw`
      SELECT
        u.id AS "userId",
        u.nickname,
        u."avatarUrl",
        us."cellsOwned" AS "cellsOwned",
        (
          6371 * acos(
            LEAST(1.0, GREATEST(-1.0,
              cos(radians(${lat})) * cos(radians(u."homeLat")) *
              cos(radians(u."homeLng") - radians(${lng})) +
              sin(radians(${lat})) * sin(radians(u."homeLat"))
            ))
          )
        ) AS "distanceKm"
      FROM "User" u
      INNER JOIN "UserStats" us ON us."userId" = u.id
      WHERE u."homeLat" IS NOT NULL
        AND u."homeLng" IS NOT NULL
        AND us."cellsOwned" > 0
        AND (
          (
            6371 * acos(
              LEAST(1.0, GREATEST(-1.0,
                cos(radians(${lat})) * cos(radians(u."homeLat")) *
                cos(radians(u."homeLng") - radians(${lng})) +
                sin(radians(${lat})) * sin(radians(u."homeLat"))
              ))
            )
          ) <= ${radiusKm}
          OR u.id = ${userId}
        )
      ORDER BY us."cellsOwned" DESC
      LIMIT ${REGIONAL_TOP_LIMIT}
    `) as RegionalRow[];

    const items: RegionalLeaderboardEntry[] = rows.map((row, index) => ({
      rank: index + 1,
      userId: row.userId,
      nickname: row.nickname,
      avatarUrl: row.avatarUrl,
      value: Number(row.cellsOwned),
      distanceKm: Math.round(Number(row.distanceKm) * 10) / 10,
    }));

    const result: RegionalLeaderboardResult = { noHomeBase: false, items };
    await this.redisService.set(cacheKey, JSON.stringify(result), REGIONAL_CACHE_TTL_SECONDS);
    return result;
  }

  async getSeasonLeaderboard(limit: number = 50) {
    const activeSeason = await this.prisma.season.findFirst({
      where: { status: 'active' },
      orderBy: { number: 'desc' },
    });

    if (!activeSeason) {
      return { season: null, items: [] };
    }

    const cacheKey = `leaderboard:season:${activeSeason.number}:${limit}`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as SeasonLeaderboardResult;
    }

    const stats = await this.prisma.userStats.findMany({
      where: { seasonCellsOwned: { gt: 0 } },
      orderBy: [{ seasonCellsOwned: 'desc' }, { seasonInfluence: 'desc' }],
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

    const items = stats.map((stat, index) => ({
      rank: index + 1,
      userId: stat.userId,
      nickname: stat.user.nickname,
      avatarUrl: stat.user.avatarUrl,
      value: stat.seasonCellsOwned,
      seasonInfluence: Math.round(stat.seasonInfluence),
    }));

    const daysLeft = Math.max(
      0,
      Math.ceil((activeSeason.endDate.getTime() - Date.now()) / 86_400_000),
    );

    const payload = {
      season: {
        number: activeSeason.number,
        startDate: activeSeason.startDate.toISOString(),
        endDate: activeSeason.endDate.toISOString(),
        daysLeft,
      },
      items,
    };

    await this.redisService.set(cacheKey, JSON.stringify(payload), 60);
    return payload;
  }

  async getSeasonHistory(userId: string) {
    const results = await this.prisma.seasonResult.findMany({
      where: { userId },
      include: { season: true },
      orderBy: { season: { number: 'desc' } },
    });

    return results.map((entry) => ({
      seasonNumber: entry.season.number,
      rank: entry.rank,
      cellsOwned: entry.cellsOwned,
      totalInfluence: entry.totalInfluence,
      endedAt: entry.season.endDate.toISOString(),
    }));
  }
}
