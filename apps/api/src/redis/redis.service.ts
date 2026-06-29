import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client!: Redis;

  onModuleInit() {
    this.client = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT) || 6379,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    });

    this.client.on('error', (err: Error) => {
      this.logger.warn(`Redis unavailable: ${err.message}`);
    });

    void this.client.connect().catch((err: Error) => {
      this.logger.warn(`Redis not connected (map cache disabled): ${err.message}`);
    });
  }

  async onModuleDestroy() {
    if (this.client.status !== 'end') {
      await this.client.quit().catch(() => undefined);
    }
  }

  async get(key: string): Promise<string | null> {
    if (this.client.status !== 'ready') {
      return null;
    }
    try {
      return await this.client.get(key);
    } catch (err) {
      this.logger.warn(
        `Redis GET failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    if (this.client.status !== 'ready') {
      return;
    }
    try {
      await this.client.set(key, value, 'EX', ttlSeconds);
    } catch (err) {
      this.logger.warn(
        `Redis SET failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async del(key: string): Promise<void> {
    if (this.client.status !== 'ready') {
      return;
    }
    try {
      await this.client.del(key);
    } catch {
      /* non-critical */
    }
  }

  async ping(): Promise<string> {
    if (this.client.status !== 'ready') {
      await this.client.connect();
    }
    return this.client.ping();
  }
}