import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { MapQueryDto } from './dto/map-query.dto';
import { CellResponseDto } from './dto/cell-response.dto';
import { isWithinBbox, roundCoord } from '../common/geo.util';

@Injectable()
export class MapService {
  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
  ) {}

  async getCells(query: MapQueryDto): Promise<CellResponseDto[]> {
    const limit = Number(query.limit) || 1000;
    const north = roundCoord(query.north);
    const south = roundCoord(query.south);
    const east = roundCoord(query.east);
    const west = roundCoord(query.west);

    const cacheKey = `map:bbox:${north}:${south}:${east}:${west}:${limit}`;

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
        if (!center) {
          return false;
        }
        return isWithinBbox(center.lat, center.lng, north, south, east, west);
      })
      .slice(0, limit);

    const result: CellResponseDto[] = filtered.map((cell) => {
      const topOwner = cell.ownerships[0];
      const center = cell.center as { lat: number; lng: number } | null;
      return {
        h3Index: cell.h3Index,
        ownerId: topOwner?.userId || null,
        ownerNickname: topOwner?.user?.nickname || null,
        influence: topOwner?.influence || 0,
        lastActivityAt: topOwner?.lastActivityAt || null,
        lat: center?.lat ?? null,
        lng: center?.lng ?? null,
      };
    });

    await this.redisService.set(cacheKey, JSON.stringify(result), 60);

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

    return ownerships.map((ownership) => {
      const cell = ownership.cell;
      const topOwner = cell.ownerships[0];
      const center = cell.center as { lat: number; lng: number } | null;
      return {
        h3Index: cell.h3Index,
        ownerId: topOwner?.userId || null,
        ownerNickname: topOwner?.user?.nickname || null,
        influence: topOwner?.influence || 0,
        lastActivityAt: topOwner?.lastActivityAt || null,
        lat: center?.lat ?? null,
        lng: center?.lng ?? null,
      };
    });
  }
}
