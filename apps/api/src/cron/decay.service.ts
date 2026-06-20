import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
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

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 14); // 14 дней назад

    // 1. Удаляем записи старше 14 дней (заброшенные территории)
    const deleted = await this.prisma.cellOwnership.deleteMany({
      where: {
        lastActivityAt: {
          lt: cutoffDate,
        },
      },
    });
    this.logger.log(`Deleted ${deleted.count} abandoned ownerships`);

    // 2. Для оставшихся записей применяем распад (influence *= 0.98)
    // Получаем все записи, которые нужно обновить
    const ownerships = await this.prisma.cellOwnership.findMany({
      where: {
        lastActivityAt: {
          gte: cutoffDate,
        },
      },
    });

    this.logger.log(`Updating ${ownerships.length} ownerships with decay`);

    // Обновляем каждую запись в цикле (для MVP подходит)
    // Для продакшена лучше использовать один большой UPDATE запрос
    for (const ownership of ownerships) {
      const newInfluence = ownership.influence * 0.98;
      // Округляем до 2 знаков, чтобы не накапливать ошибки
      const rounded = Math.round(newInfluence * 100) / 100;

      await this.prisma.cellOwnership.update({
        where: {
          h3Index_userId: {
            h3Index: ownership.h3Index,
            userId: ownership.userId,
          },
        },
        data: {
          influence: rounded,
        },
      });
    }

    // 3. Пересчитываем владельцев для всех клеток, у которых изменилось влияние
    // Собираем уникальные h3Index
    const h3Indices = [...new Set(ownerships.map((o) => o.h3Index))];
    if (h3Indices.length > 0) {
      await this.ownershipService.recalculateOwners(h3Indices);
      this.logger.log(`Recalculated owners for ${h3Indices.length} cells`);
    }

    this.logger.log('Daily decay completed');
  }

  // Для тестирования: запуск вручную через эндпоинт (опционально)
  async runDecayManually() {
    await this.decayInfluence();
  }
}
