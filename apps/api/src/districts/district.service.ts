import { Injectable, HttpStatus, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { FeedService } from '../feed/feed.service';
import { OwnershipService } from '../territories/ownership.service';
import { GeoJsonPolygon, isPointInPolygon } from '../common/geo.util';
import { KING_CLAIM_THRESHOLD, KING_LOSS_THRESHOLD } from '../common/constants';
import { ApiException } from '../common/api.exception';
import { ErrorCodes } from '../common/error-codes';

@Injectable()
export class DistrictService {
  private readonly cacheKey = 'districts:polygons';
  private readonly cacheTtlSec = 300;

  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
    private feedService: FeedService,
    @Inject(forwardRef(() => OwnershipService))
    private ownershipService: OwnershipService,
  ) {}

  async assignCellToDistrict(h3Index: string, lat: number, lng: number): Promise<void> {
    const existing = await this.prisma.districtCell.findFirst({
      where: { h3Index },
    });
    if (existing) {
      return;
    }

    const districts = await this.getDistrictPolygons();
    for (const district of districts) {
      if (!isPointInPolygon(lat, lng, district.polygon)) {
        continue;
      }

      await this.prisma.districtCell.create({
        data: {
          districtId: district.id,
          h3Index,
        },
      });
      return;
    }
  }

  async recalculateDistrictControl(districtId: string): Promise<void> {
    const district = await this.prisma.district.findUnique({
      where: { id: districtId },
      include: { cells: true },
    });
    if (!district || district.cells.length === 0) {
      return;
    }

    const totalCells = district.cells.length;
    const ownerCounts = new Map<string, number>();

    for (const districtCell of district.cells) {
      const owner = await this.ownershipService.getCurrentOwner(districtCell.h3Index);
      if (!owner) {
        continue;
      }
      ownerCounts.set(owner.userId, (ownerCounts.get(owner.userId) || 0) + 1);
    }

    const currentKingId = district.kingUserId;
    let nextKingId = currentKingId;
    let crownedShare = 0;

    if (currentKingId) {
      const kingShare = (ownerCounts.get(currentKingId) || 0) / totalCells;
      if (kingShare < KING_LOSS_THRESHOLD) {
        nextKingId = null;
      }
    } else {
      let topCandidateId: string | null = null;
      let topCandidateShare = 0;

      for (const [userId, count] of ownerCounts.entries()) {
        const share = count / totalCells;
        if (share >= KING_CLAIM_THRESHOLD && share > topCandidateShare) {
          topCandidateId = userId;
          topCandidateShare = share;
        }
      }

      if (topCandidateId) {
        nextKingId = topCandidateId;
        crownedShare = topCandidateShare;
      }
    }

    if (nextKingId === currentKingId) {
      return;
    }

    await this.prisma.district.update({
      where: { id: districtId },
      data: { kingUserId: nextKingId },
    });

    if (nextKingId) {
      const kingUser = await this.prisma.user.findUnique({ where: { id: nextKingId } });
      await this.feedService.createEvent('district_captured', nextKingId, {
        districtId,
        districtName: district.name,
        controlPercent: Math.round(crownedShare * 100),
        kingNickname: kingUser?.nickname ?? null,
      });
    }
  }

  async recalculateForCells(h3Indices: string[]): Promise<void> {
    const districtIds = new Set<string>();

    for (const h3Index of h3Indices) {
      const links = await this.prisma.districtCell.findMany({
        where: { h3Index },
        select: { districtId: true },
      });
      for (const link of links) {
        districtIds.add(link.districtId);
      }
    }

    for (const districtId of districtIds) {
      await this.recalculateDistrictControl(districtId);
    }
  }

  async getDistrict(id: string) {
    const district = await this.prisma.district.findUnique({
      where: { id },
      include: {
        kingUser: { select: { id: true, nickname: true } },
        cells: true,
      },
    });

    if (!district) {
      throw new ApiException(ErrorCodes.NOT_FOUND, 'District not found', HttpStatus.NOT_FOUND);
    }

    const totalCells = district.cells.length;
    const controlByUser = new Map<string, { nickname: string; cells: number }>();

    for (const districtCell of district.cells) {
      const owner = await this.ownershipService.getCurrentOwner(districtCell.h3Index);
      if (!owner) {
        continue;
      }
      const current = controlByUser.get(owner.userId) ?? {
        nickname: owner.user.nickname,
        cells: 0,
      };
      current.cells += 1;
      controlByUser.set(owner.userId, current);
    }

    const topPlayers = [...controlByUser.entries()]
      .map(([userId, data]) => ({
        userId,
        nickname: data.nickname,
        controlPercent: totalCells > 0 ? Math.round((data.cells / totalCells) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.controlPercent - a.controlPercent)
      .slice(0, 5);

    const kingControl = district.kingUserId
      ? topPlayers.find((player) => player.userId === district.kingUserId)?.controlPercent ?? 0
      : null;

    return {
      id: district.id,
      name: district.name,
      totalCells,
      king: district.kingUser
        ? {
            userId: district.kingUser.id,
            nickname: district.kingUser.nickname,
            controlPercent: kingControl,
          }
        : null,
      topPlayers,
    };
  }

  async listDistricts() {
    const districts = await this.prisma.district.findMany({
      include: { kingUser: { select: { id: true, nickname: true } } },
      orderBy: { name: 'asc' },
    });

    return districts.map((d) => ({
      id: d.id,
      name: d.name,
      polygon: d.polygon,
      king: d.kingUser
        ? { userId: d.kingUser.id, nickname: d.kingUser.nickname }
        : null,
    }));
  }

  async getUserDistrictProgress(userId: string, districtId: string) {
    const district = await this.getDistrict(districtId);
    const myEntry = district.topPlayers.find((p) => p.userId === userId);
    const controlPercent = myEntry?.controlPercent ?? 0;

    return {
      districtId: district.id,
      districtName: district.name,
      myControlPercent: controlPercent,
      kingThresholdPercent: Math.round(KING_CLAIM_THRESHOLD * 100),
      isKing: district.king?.userId === userId,
      king: district.king,
    };
  }

  async listUserDistrictOverview(userId: string, minPercent = 15) {
    const districts = await this.prisma.district.findMany({
      include: {
        cells: true,
        kingUser: { select: { id: true, nickname: true } },
      },
      orderBy: { name: 'asc' },
    });

    const results = [];

    for (const district of districts) {
      if (district.cells.length === 0) {
        continue;
      }

      const totalCells = district.cells.length;
      const ownerCounts = new Map<string, number>();

      for (const districtCell of district.cells) {
        const owner = await this.ownershipService.getCurrentOwner(districtCell.h3Index);
        if (!owner) {
          continue;
        }
        ownerCounts.set(owner.userId, (ownerCounts.get(owner.userId) || 0) + 1);
      }

      const myCells = ownerCounts.get(userId) || 0;
      const controlPercent = Math.round((myCells / totalCells) * 1000) / 10;
      if (controlPercent < minPercent) {
        continue;
      }

      const kingCells = district.kingUserId
        ? ownerCounts.get(district.kingUserId) || 0
        : 0;

      results.push({
        districtId: district.id,
        districtName: district.name,
        myControlPercent: controlPercent,
        kingThresholdPercent: Math.round(KING_CLAIM_THRESHOLD * 100),
        isKing: district.kingUserId === userId,
        king: district.kingUser
          ? {
              userId: district.kingUser.id,
              nickname: district.kingUser.nickname,
              controlPercent: district.kingUserId
                ? Math.round((kingCells / totalCells) * 1000) / 10
                : null,
            }
          : null,
      });
    }

    return results.sort((a, b) => b.myControlPercent - a.myControlPercent);
  }

  async getDistrictCells(id: string) {
    const district = await this.prisma.district.findUnique({
      where: { id },
      include: { cells: true },
    });

    if (!district) {
      throw new ApiException(ErrorCodes.NOT_FOUND, 'District not found', HttpStatus.NOT_FOUND);
    }

    return {
      districtId: district.id,
      cells: district.cells.map((cell) => cell.h3Index),
    };
  }

  private async getDistrictPolygons(): Promise<Array<{ id: string; polygon: GeoJsonPolygon }>> {
    const cached = await this.redisService.get(this.cacheKey);
    if (cached) {
      return JSON.parse(cached) as Array<{ id: string; polygon: GeoJsonPolygon }>;
    }

    const districts = await this.prisma.district.findMany({
      select: { id: true, polygon: true },
    });

    const result = districts.map((district) => ({
      id: district.id,
      polygon: district.polygon as GeoJsonPolygon,
    }));

    await this.redisService.set(this.cacheKey, JSON.stringify(result), this.cacheTtlSec);
    return result;
  }
}
