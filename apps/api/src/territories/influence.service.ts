import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import * as h3 from 'h3-js';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DistrictService } from '../districts/district.service';
import {
  distanceMetersByH3Cell,
  influenceDistanceWeight,
} from '../common/track-distance.util';
import {
  BASE_INFLUENCE,
  MAX_INFLUENCE_PER_CELL,
  MIN_CELL_DISTANCE_M,
  roundInfluence,
  streakMultiplier,
} from '../common/constants';
import {
  capInfluenceGainMultiplier,
  locationInfluenceMultiplier,
  softCapMultiplier,
} from '../common/influence-gain.util';

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

  async processTrack(
    userId: string,
    track: { lat: number; lng: number }[],
    activityAt?: Date,
  ) {
    const distanceByH3 = distanceMetersByH3Cell(track);
    const h3Indices = [...distanceByH3.keys()];

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
    const softCapMult = softCapMultiplier(cellsOwned);

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

    const now = activityAt ?? new Date();
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
      const metersInCell = distanceByH3.get(h3Index) ?? 0;
      const distanceWeight = influenceDistanceWeight(metersInCell, MIN_CELL_DISTANCE_M);
      if (distanceWeight <= 0) {
        continue;
      }

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
      const rawMult =
        locationInfluenceMultiplier(user, center, existing != null) *
        streakMult *
        softCapMult;
      const influence = roundInfluence(
        BASE_INFLUENCE * capInfluenceGainMultiplier(rawMult) * distanceWeight,
      );

      if (influence <= 0) {
        continue;
      }

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

    const affectedIndices = [
      ...ownershipUpdates.map((row) => row.h3Index),
      ...ownershipCreates.map((row) => row.h3Index),
    ];

    await this.prisma.$transaction(async (tx) => {
      if (cellsToCreate.length > 0) {
        await tx.cell.createMany({ data: cellsToCreate, skipDuplicates: true });
      }

      if (ownershipUpdates.length > 0) {
        await this.batchUpdateOwnershipInfluence(tx, userId, ownershipUpdates, now);
      }

      if (ownershipCreates.length > 0) {
        await tx.cellOwnership.createMany({ data: ownershipCreates });
      }
    });

    if (newCellDistricts.length > 0) {
      await this.districtService.assignCellsToDistricts(newCellDistricts);
    }

    return { h3Indices: affectedIndices, influenceAdded };
  }

  private async batchUpdateOwnershipInfluence(
    tx: Prisma.TransactionClient,
    userId: string,
    updates: Array<{ h3Index: string; influence: number }>,
    lastActivityAt: Date,
  ) {
    const h3Indices = updates.map((row) => row.h3Index);
    const influences = updates.map((row) => row.influence);

    await tx.$executeRaw`
      UPDATE "CellOwnership" AS co
      SET
        influence = batch.influence,
        "lastActivityAt" = GREATEST(co."lastActivityAt", ${lastActivityAt})
      FROM (
        SELECT *
        FROM UNNEST(
          ${h3Indices}::text[],
          ${influences}::double precision[]
        ) AS t("h3Index", influence)
      ) AS batch
      WHERE co."h3Index" = batch."h3Index"
        AND co."userId" = ${userId}
    `;
  }
}
