import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InfluenceService {
  constructor(private prisma: PrismaService) {}

  async processTrack(userId: string, track: { lat: number; lng: number }[]) {
    const h3Module = await import('h3-js');
    const h3 = h3Module.default || h3Module;

    const cellSet = new Set<string>();
    for (const point of track) {
      const h3Index = h3.latLngToCell(point.lat, point.lng, 9);
      cellSet.add(h3Index);
    }

    const h3Indices = Array.from(cellSet);
    console.log(`[Influence] Уникальных клеток: ${h3Indices.length}`);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) throw new Error('User not found');

    for (const h3Index of h3Indices) {
      // Получаем центр клетки для сохранения
      const centerCoords = h3.cellToLatLng(h3Index);
      const center = { lat: centerCoords[0], lng: centerCoords[1] };

      // Создаём или обновляем клетку с центром
      await this.prisma.cell.upsert({
        where: { h3Index },
        update: {},
        create: {
          h3Index,
          center: center, // сохраняем как JSON
        },
      });

      let influence = 1;
      if (user.homeLat && user.homeLng) {
        const distance = this.haversineDistance(
          user.homeLat,
          user.homeLng,
          center.lat,
          center.lng,
        );
        if (distance <= 500) {
          influence = 1.5;
        }
      }

      const existing = await this.prisma.cellOwnership.findUnique({
        where: {
          h3Index_userId: { h3Index, userId },
        },
      });

      if (existing) {
        await this.prisma.cellOwnership.update({
          where: {
            h3Index_userId: { h3Index, userId },
          },
          data: {
            influence: existing.influence + influence,
            lastActivityAt: new Date(),
          },
        });
      } else {
        await this.prisma.cellOwnership.create({
          data: {
            h3Index,
            userId,
            influence,
            lastActivityAt: new Date(),
          },
        });
      }
    }

    return h3Indices;
  }

  private haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
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
