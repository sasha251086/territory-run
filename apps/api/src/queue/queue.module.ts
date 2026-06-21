import { Module } from '@nestjs/common';
import { QueueService } from './queue.service';
import { PrismaModule } from '../prisma/prisma.module';
import { TerritoriesModule } from '../territories/territories.module';
import { FeedModule } from '../feed/feed.module';
import { AnticheatModule } from '../activities/anticheat.module';

@Module({
  imports: [PrismaModule, TerritoriesModule, FeedModule, AnticheatModule],
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {}