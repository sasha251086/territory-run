import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
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
import { DistrictsModule } from './districts/districts.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000,
        limit: 100,
      },
    ]),
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
    DistrictsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
