import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  DECAY_DELETE_AFTER_DAYS,
  DECAY_GRACE_DAYS,
  DECAY_RATE_PER_DAY,
  FREEZE_DURATION_DAYS,
} from '../common/constants';
import { PrismaService } from '../prisma/prisma.service';
import { OwnershipService } from '../territories/ownership.service';

@Injectable()
export class DecayService {
  private readonly logger = new Logger(DecayService.name);

  constructor(
    private prisma: PrismaService,
    private ownershipService: OwnershipService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT) // 00:00 UTC
  async decayInfluence() {
    this.logger.log('Starting daily influence decay');

    const deleteCutoff = new Date();
    deleteCutoff.setDate(deleteCutoff.getDate() - DECAY_DELETE_AFTER_DAYS);

    const graceCutoff = new Date();
    graceCutoff.setDate(graceCutoff.getDate() - DECAY_GRACE_DAYS);

    const deleted = await this.prisma.cellOwnership.deleteMany({
      where: {
        lastActivityAt: {
          lt: deleteCutoff,
        },
        user: {
          freezeActive: false,
        },
      },
    });
    this.logger.log(`Deleted ${deleted.count} abandoned ownerships`);

    const affectedCells = await this.prisma.cellOwnership.findMany({
      where: {
        lastActivityAt: {
          gte: deleteCutoff,
          lt: graceCutoff,
        },
      },
      select: { h3Index: true },
      distinct: ['h3Index'],
    });

    const updated = await this.prisma.$executeRaw`
      UPDATE "CellOwnership"
      SET influence = GREATEST(0, FLOOR(influence * ${DECAY_RATE_PER_DAY}))
      WHERE "lastActivityAt" >= ${deleteCutoff}
        AND "lastActivityAt" < ${graceCutoff}
    `;
    this.logger.log(`Updated ${updated} ownerships with proportional decay`);

    const h3Indices = affectedCells.map((row) => row.h3Index);
    if (h3Indices.length > 0) {
      await this.ownershipService.recalculateOwners(h3Indices);
      this.logger.log(`Recalculated owners for ${h3Indices.length} cells`);
    }

    const freezeExpiry = new Date();
    freezeExpiry.setDate(freezeExpiry.getDate() - FREEZE_DURATION_DAYS);
    const expiredFreezes = await this.prisma.user.updateMany({
      where: {
        freezeActive: true,
        freezeActivatedAt: {
          lt: freezeExpiry,
        },
      },
      data: {
        freezeActive: false,
      },
    });
    if (expiredFreezes.count > 0) {
      this.logger.log(`Expired ${expiredFreezes.count} territory freezes`);
    }

    this.logger.log('Daily decay completed');
  }

  async runDecayManually() {
    await this.decayInfluence();
  }
}
