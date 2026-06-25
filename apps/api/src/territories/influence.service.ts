import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import * as h3 from 'h3-js';
import { PrismaService } from '../prisma/prisma.service';
import { DistrictService } from '../districts/district.service';
import { haversineDistance } from '../common/geo.util';
import {
  BASE_INFLUENCE,
  HOME_ZONE_BONUS_MULTIPLIER,
  HOME_ZONE_RADIUS_M,
  MAX_INFLUENCE_PER_CELL,
  NEW_PLAYER_BONUS_MULTIPLIER,
  NEW_PLAYER_PERIOD_MS,
  SOFT_CAP_CELLS,
  SOFT_CAP_INFLUENCE_MULTIPLIER,
  streakMultiplier,
} from '../common/constants';

export type ProcessTrackResult = {
  h3Indices: string[];
  influenceAdded: number;
};

@Injectable()
export class InfluenceService {
  private readonly logger = new Logger(InfluenceService.name);

  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => DistrictService))
    private districtService: DistrictService,
  ) {}

  async processTrack(userId: string, track: { lat: number; lng: number }[]) {
    const cellSet = new Set<string>();
    for (const point of track) {
      cellSet.add(h3.latLngToCell(point.lat, point.lng, 9));
    }

    const h3Indices = Array.from(cellSet);
    this.logger.log({
      msg: 'Processing track influence',
      userId,
      uniqueCells: h3Indices.length,
    });

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { stats: true },
    });
    if (!user) throw new Error('User not found');

    const streak = user.stats?.currentStreak ?? 0;
    const streakMult = streakMultiplier(streak);
    const cellsOwned = user.stats?.cellsOwned ?? 0;
    const softCapMult =
      cellsOwned >= SOFT_CAP_CELLS ? SOFT_CAP_INFLUENCE_MULTIPLIER : 1;

    const [existingCells, existingOwnerships] = await Promise.all([
      this.prisma.cell.findMany({
        where: { h3Index: { in: h3Indices } },
        select: { h3Index: true },
      }),
      this.prisma.cellOwnership.findMany({
        where: { h3Index: { in: h3Indices }, userId },
      }),
    ]);

    const existingCellSet = new Set(existingCells.map((cell) => cell.h3Index));
    const ownershipMap = new Map(existingOwnerships.map((o) => [o.h3Index, o]));

    const now = new Date();
    let influenceAdded = 0;

    const cellsToCreate: Array<{
      h3Index: string;
      center: { lat: number; lng: number };
      centerLat: number;
      centerLng: number;
    }> = [];
    const ownershipCreates: Array<{
      h3Index: string;
      userId: string;
      influence: number;
      lastActivityAt: Date;
    }> = [];
    const ownershipUpdates: Array<{ h3Index: string; influence: number }> = [];
    const newCellDistricts: Array<{ h3Index: string; lat: number; lng: number }> = [];

    for (const h3Index of h3Indices) {
      const centerCoords = h3.cellToLatLng(h3Index);
      const center = { lat: centerCoords[0], lng: centerCoords[1] };

      if (!existingCellSet.has(h3Index)) {
        cellsToCreate.push({
          h3Index,
          center,
          centerLat: center.lat,
          centerLng: center.lng,
        });
        newCellDistricts.push({ h3Index, lat: center.lat, lng: center.lng });
      }

      const existing = ownershipMap.get(h3Index) ?? null;
      const influence =
        this.calculateInfluence(user, center, existing) * streakMult * softCapMult;

      if (existing) {
        const nextInfluence = Math.min(
          existing.influence + influence,
          MAX_INFLUENCE_PER_CELL,
        );
        influenceAdded += nextInfluence - existing.influence;
        ownershipUpdates.push({ h3Index, influence: nextInfluence });
      } else {
        const nextInfluence = Math.min(influence, MAX_INFLUENCE_PER_CELL);
        influenceAdded += nextInfluence;
        ownershipCreates.push({
          h3Index,
          userId,
          influence: nextInfluence,
          lastActivityAt: now,
        });
      }
    }

    await this.prisma.$transaction(async (tx) => {
      if (cellsToCreate.length > 0) {
        await tx.cell.createMany({ data: cellsToCreate, skipDuplicates: true });
      }

      for (const update of ownershipUpdates) {
        await tx.cellOwnership.update({
          where: {
            h3Index_userId: { h3Index: update.h3Index, userId },
          },
          data: {
            influence: update.influence,
            lastActivityAt: now,
          },
        });
      }

      if (ownershipCreates.length > 0) {
        await tx.cellOwnership.createMany({ data: ownershipCreates });
      }
    });

    for (const cell of newCellDistricts) {
      await this.districtService.assignCellToDistrict(cell.h3Index, cell.lat, cell.lng);
    }

    return { h3Indices, influenceAdded };
  }

  private calculateInfluence(
    user: {
      homeLat: number | null;
      homeLng: number | null;
      createdAt: Date;
    },
    center: { lat: number; lng: number },
    existing: { influence: number } | null,
  ): number {
    const isInHomeZone =
      user.homeLat != null &&
      user.homeLng != null &&
      haversineDistance(user.homeLat, user.homeLng, center.lat, center.lng) <=
        HOME_ZONE_RADIUS_M;

    if (isInHomeZone) {
      return BASE_INFLUENCE * HOME_ZONE_BONUS_MULTIPLIER;
    }

    if (!existing && this.isNewPlayer(user.createdAt)) {
      return BASE_INFLUENCE * NEW_PLAYER_BONUS_MULTIPLIER;
    }

    return BASE_INFLUENCE;
  }

  private isNewPlayer(createdAt: Date): boolean {
    return Date.now() - createdAt.getTime() < NEW_PLAYER_PERIOD_MS;
  }
}
