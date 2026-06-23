import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
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
import { IntegrationsModule } from './integrations/integrations.module';
import { RivalsModule } from './rivals/rivals.module';
import { HttpExceptionFilter } from './common/http-exception.filter';

const isProduction = process.env.NODE_ENV === 'production';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: isProduction ? 'info' : 'debug',
        transport: isProduction
          ? undefined
          : {
              target: 'pino-pretty',
              options: {
                singleLine: true,
                colorize: true,
              },
            },
      },
    }),
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
    IntegrationsModule,
    RivalsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule {}
