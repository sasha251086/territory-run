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
    return this.prisma.cell.findMany({
      where: {
        centerLat: { gte: south, lte: north },
        centerLng: { gte: west, lte: east },
      },
      include: {
        ownerships: {
          include: { user: true },
          orderBy: { influence: 'desc' },
        },
      },
      take: 1000,
    });
  }
}
