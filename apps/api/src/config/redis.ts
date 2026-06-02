// apps/api/src/config/redis.ts
import { RedisOptions } from 'ioredis';

export function getRedisConfig(): RedisOptions {
  const host = process.env.REDIS_HOST ?? '127.0.0.1';
  const port = Number(process.env.REDIS_PORT ?? 6379);

  return {
    host,
    port,
    // You can tune retryStrategy, maxRetriesPerRequest, etc. later
  };
}

export function isQueueEnabled(): boolean {
  return process.env.USE_QUEUE === 'true';
}