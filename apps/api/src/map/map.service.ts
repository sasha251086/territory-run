import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { MapQueryDto } from './dto/map-query.dto';
import { CellResponseDto } from './dto/cell-response.dto';

@Injectable()
export class MapService {
  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
  ) {}

  async getCells(query: MapQueryDto): Promise<CellResponseDto[]> {
    const limit = Number(query.limit) || 1000;

    const cacheKey = `map:all:${limit}`;

    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      console.log('[Map] Cache hit');
      return JSON.parse(cached);
    }

    console.log('[Map] Cache miss, querying DB');

    const cells = await this.prisma.cell.findMany({
      include: {
        ownerships: {
          include: { user: true },
          orderBy: { influence: 'desc' },
        },
      },
      take: limit,
    });

    const result: CellResponseDto[] = cells.map((cell) => {
      const topOwner = cell.ownerships[0];
      return {
        h3Index: cell.h3Index,
        ownerId: topOwner?.userId || null,
        ownerNickname: topOwner?.user?.nickname || null,
        influence: topOwner?.influence || 0,
        lastActivityAt: topOwner?.lastActivityAt || null,
      };
    });

    await this.redisService.set(cacheKey, JSON.stringify(result), 60);

    return result;
  }
}
