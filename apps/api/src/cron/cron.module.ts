import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DecayService } from './decay.service';
import { DecayController } from './decay.controller';
import { SeasonService } from './season.service';
import { PrismaModule } from '../prisma/prisma.module';
import { TerritoriesModule } from '../territories/territories.module';
import { QueueModule } from '../queue/queue.module';
import { QueueMonitorService } from '../queue/queue-monitor.service';

@Module({
  imports: [ScheduleModule.forRoot(), PrismaModule, TerritoriesModule, QueueModule],
  controllers: [DecayController],
  providers: [DecayService, QueueMonitorService, SeasonService],
})
export class CronModule {}
