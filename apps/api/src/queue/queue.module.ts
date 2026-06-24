import { Module } from '@nestjs/common';
import { QueueService } from './queue.service';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { TerritoriesModule } from '../territories/territories.module';
import { FeedModule } from '../feed/feed.module';
import { AnticheatModule } from '../activities/anticheat.module';

@Module({
  imports: [PrismaModule, RedisModule, TerritoriesModule, FeedModule, AnticheatModule],
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {}