import {
  Controller,
  Get,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@Controller('health')
export class HealthController {
  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
  ) {}

  @Get()
  async check() {
    const checks = {
      database: 'ok',
      redis: 'ok',
    };

    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      checks.database = 'error';
    }

    try {
      const pong = await this.redisService.ping();
      if (pong !== 'PONG') {
        checks.redis = 'error';
      }
    } catch {
      checks.redis = 'error';
    }

    const healthy = checks.database === 'ok' && checks.redis === 'ok';
    const body = {
      status: healthy ? 'ok' : 'degraded',
      checks,
    };

    if (!healthy) {
      throw new ServiceUnavailableException(body);
    }

    return body;
  }
}
