import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { SEASON_DURATION_DAYS } from '../common/constants';

@Injectable()
export class SeasonService implements OnModuleInit {
  private readonly logger = new Logger(SeasonService.name);

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    await this.ensureActiveSeason();
  }

  @Cron('0 3 * * *')
  async checkAndRotateSeason() {
    const active = await this.prisma.season.findFirst({
      where: { status: 'active' },
      orderBy: { number: 'desc' },
    });

    if (!active) {
      await this.ensureActiveSeason();
      return;
    }

    if (active.endDate > new Date()) {
      return;
    }

    await this.finishSeason(active.id, active.number);
  }

  async ensureActiveSeason() {
    const active = await this.prisma.season.findFirst({
      where: { status: 'active' },
      orderBy: { number: 'desc' },
    });

    if (active) {
      return active;
    }

    const last = await this.prisma.season.findFirst({
      orderBy: { number: 'desc' },
    });
    const nextNumber = (last?.number ?? 0) + 1;
    const season = await this.createSeason(nextNumber);
    this.logger.log({ msg: 'Created first/active season', seasonNumber: season.number });
    return season;
  }

  async getActiveSeason() {
    return this.prisma.season.findFirst({
      where: { status: 'active' },
      orderBy: { number: 'desc' },
    });
  }

  async getSeasonHistory(userId: string) {
    return this.prisma.seasonResult.findMany({
      where: { userId },
      include: { season: true },
      orderBy: { season: { number: 'desc' } },
    });
  }

  private async createSeason(number: number) {
    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + SEASON_DURATION_DAYS);

    return this.prisma.season.create({
      data: {
        number,
        startDate,
        endDate,
        status: 'active',
      },
    });
  }

  private async finishSeason(seasonId: number, seasonNumber: number) {
    const topPlayers = await this.prisma.userStats.findMany({
      where: { seasonCellsOwned: { gt: 0 } },
      orderBy: [{ seasonCellsOwned: 'desc' }, { seasonInfluence: 'desc' }],
      take: 100,
      include: {
        user: { select: { id: true, nickname: true } },
      },
    });

    await this.prisma.$transaction(async (tx) => {
      for (const [index, stat] of topPlayers.entries()) {
        await tx.seasonResult.create({
          data: {
            seasonId,
            userId: stat.userId,
            rank: index + 1,
            cellsOwned: stat.seasonCellsOwned,
            totalInfluence: stat.seasonInfluence,
          },
        });
      }

      await tx.season.update({
        where: { id: seasonId },
        data: { status: 'finished' },
      });

      await tx.userStats.updateMany({
        data: {
          seasonCellsOwned: 0,
          seasonInfluence: 0,
        },
      });

      const startDate = new Date();
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + SEASON_DURATION_DAYS);

      await tx.season.create({
        data: {
          number: seasonNumber + 1,
          startDate,
          endDate,
          status: 'active',
        },
      });
    });

    this.logger.log({
      msg: 'Season rotated',
      finishedSeason: seasonNumber,
      savedResults: topPlayers.length,
    });
  }
}
