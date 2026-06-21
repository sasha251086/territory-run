import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DistrictService } from '../districts/district.service';
import {
  BASE_INFLUENCE,
  HOME_ZONE_BONUS_MULTIPLIER,
  HOME_ZONE_RADIUS_M,
  MAX_INFLUENCE_PER_CELL,
  NEW_PLAYER_BONUS_MULTIPLIER,
  NEW_PLAYER_PERIOD_MS,
} from '../common/constants';

@Injectable()
export class InfluenceService {
  private readonly logger = new Logger(InfluenceService.name);

  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => DistrictService))
    private districtService: DistrictService,
  ) {}

  async processTrack(userId: string, track: { lat: number; lng: number }[]) {
    const h3Module = await import('h3-js');
    const h3 = h3Module.default || h3Module;

    const cellSet = new Set<string>();
    for (const point of track) {
      const h3Index = h3.latLngToCell(point.lat, point.lng, 9);
      cellSet.add(h3Index);
    }

    const h3Indices = Array.from(cellSet);
    this.logger.log({
      msg: 'Processing track influence',
      userId,
      uniqueCells: h3Indices.length,
    });

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) throw new Error('User not found');

    for (const h3Index of h3Indices) {
      const centerCoords = h3.cellToLatLng(h3Index);
      const center = { lat: centerCoords[0], lng: centerCoords[1] };

      const existingCell = await this.prisma.cell.findUnique({
        where: { h3Index },
      });

      await this.prisma.cell.upsert({
        where: { h3Index },
        update: {},
        create: {
          h3Index,
          center,
        },
      });

      if (!existingCell) {
        await this.districtService.assignCellToDistrict(h3Index, center.lat, center.lng);
      }

      const existing = await this.prisma.cellOwnership.findUnique({
        where: {
          h3Index_userId: { h3Index, userId },
        },
      });

      const influence = this.calculateInfluence(user, center, existing);

      if (existing) {
        await this.prisma.cellOwnership.update({
          where: {
            h3Index_userId: { h3Index, userId },
          },
          data: {
            influence: Math.min(
              existing.influence + influence,
              MAX_INFLUENCE_PER_CELL,
            ),
            lastActivityAt: new Date(),
          },
        });
      } else {
        await this.prisma.cellOwnership.create({
          data: {
            h3Index,
            userId,
            influence: Math.min(influence, MAX_INFLUENCE_PER_CELL),
            lastActivityAt: new Date(),
          },
        });
      }
    }

    return h3Indices;
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
      this.haversineDistance(
        user.homeLat,
        user.homeLng,
        center.lat,
        center.lng,
      ) <= HOME_ZONE_RADIUS_M;

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

  private haversineDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371000;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}
