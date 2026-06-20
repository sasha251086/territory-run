import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TerritoriesService {
  constructor(private prisma: PrismaService) {}

  async getCell(h3Index: string) {
    return this.prisma.cell.findUnique({
      where: { h3Index },
      include: {
        ownerships: {
          include: { user: true },
          orderBy: { influence: 'desc' },
        },
      },
    });
  }

  async getCellsInBbox(north: number, south: number, east: number, west: number) {
    // Пока заглушка, позже реализуем фильтрацию через PostGIS
    // Для MVP вернём все клетки (позже добавим ограничение по BBOX)
    return this.prisma.cell.findMany({
      include: {
        ownerships: {
          include: { user: true },
          orderBy: { influence: 'desc' },
        },
      },
      take: 1000, // ограничим для безопасности
    });
  }
}
