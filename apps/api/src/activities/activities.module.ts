import { Module } from '@nestjs/common';
import { ActivitiesController } from './activities.controller';
import { ActivitiesService } from './activities.service';
import { GpxParserService } from './gpx-parser.service';
import { SamsungHealthParserService } from './samsung-health-parser.service';
import { PrismaModule } from '../prisma/prisma.module';
import { QueueModule } from '../queue/queue.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [PrismaModule, QueueModule, RedisModule],
  controllers: [ActivitiesController],
  providers: [ActivitiesService, GpxParserService, SamsungHealthParserService],
  exports: [ActivitiesService],
})
export class ActivitiesModule {}
