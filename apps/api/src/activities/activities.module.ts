import { Module } from '@nestjs/common';
import { ActivitiesController } from './activities.controller';
import { ActivitiesService } from './activities.service';
import { GpxParserService } from './gpx-parser.service';
import { PrismaModule } from '../prisma/prisma.module';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [PrismaModule, QueueModule],
  controllers: [ActivitiesController],
  providers: [ActivitiesService, GpxParserService],
  exports: [ActivitiesService],
})
export class ActivitiesModule {}
