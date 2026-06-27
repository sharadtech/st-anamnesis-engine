import Redis from 'ioredis';
import { createRedisClient, namespacedKey } from '../config/redis.js';
import type { VerificationReport } from './GraphVerifier.js';

export class VerificationRepository {
  private readonly redis: Redis;

  constructor(redis?: Redis) {
    this.redis = redis ?? createRedisClient();
  }

  async saveReport(companyId: string, report: VerificationReport): Promise<void> {
    await this.redis.set(namespacedKey('verification', companyId), JSON.stringify(report));
  }

  async loadReport(companyId: string): Promise<VerificationReport | null> {
    const raw = await this.redis.get(namespacedKey('verification', companyId));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as VerificationReport;
    } catch {
      return null;
    }
  }

  async delete(companyId: string): Promise<void> {
    await this.redis.del(namespacedKey('verification', companyId));
  }
}
