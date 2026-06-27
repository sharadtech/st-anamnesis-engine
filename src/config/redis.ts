import Redis from 'ioredis';
import { Config } from './Config.js';

export const redisConnectionOptions = {
  host: Config.redis.host,
  port: Config.redis.port,
  db: Config.redis.db,
  password: Config.redis.password,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
} as const;

export function createRedisClient(): Redis {
  return new Redis(redisConnectionOptions);
}

export function namespacedKey(...parts: string[]): string {
  return [Config.redis.namespace, ...parts].join(':');
}
