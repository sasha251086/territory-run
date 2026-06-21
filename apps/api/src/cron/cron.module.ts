import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DecayService } from './decay.service';
import { DecayController } from './decay.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { TerritoriesModule } from '../territories/territories.module';
import { QueueModule } from '../queue/queue.module';
import { QueueMonitorService } from '../queue/queue-monitor.service';

@Module({
  imports: [ScheduleModule.forRoot(), PrismaModule, TerritoriesModule, QueueModule],
  controllers: [DecayController],
  providers: [DecayService, QueueMonitorService],
})
export class CronModule {}
