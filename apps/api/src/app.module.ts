import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PrismaModule } from './prisma/prisma.module';
import { ActivitiesModule } from './activities/activities.module';
import { QueueModule } from './queue/queue.module';
import { TerritoriesModule } from './territories/territories.module';
import { MapModule } from './map/map.module';
import { RedisModule } from './redis/redis.module';
import { CronModule } from './cron/cron.module';
import { FeedModule } from './feed/feed.module';
import { LeaderboardModule } from './leaderboard/leaderboard.module';

@Module({
  imports: [
    PrismaModule,
    UsersModule,
    AuthModule,
    ActivitiesModule,
    QueueModule,
    TerritoriesModule,
    RedisModule,
    MapModule,
    CronModule,
    FeedModule,
    LeaderboardModule,
  ],
})
export class AppModule {}
