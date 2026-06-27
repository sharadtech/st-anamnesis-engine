import Redis from 'ioredis';
import { createRedisClient, namespacedKey } from '../config/redis.js';
import type { GraphMeta, SerializedGraph } from '../types/Extraction.js';

export class GraphRepository {
  private readonly redis: Redis;

  constructor(redis?: Redis) {
    this.redis = redis ?? createRedisClient();
  }

  async saveGraph(companyId: string, graph: SerializedGraph): Promise<void> {
    await this.redis.set(namespacedKey('graph', companyId), JSON.stringify(graph));
  }

  async loadGraph(companyId: string): Promise<SerializedGraph | null> {
    const raw = await this.redis.get(namespacedKey('graph', companyId));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as SerializedGraph;
    } catch {
      return null;
    }
  }

  async saveMeta(companyId: string, meta: GraphMeta): Promise<void> {
    await this.redis.set(namespacedKey('meta', companyId), JSON.stringify(meta));
  }

  async loadMeta(companyId: string): Promise<GraphMeta | null> {
    const raw = await this.redis.get(namespacedKey('meta', companyId));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as GraphMeta;
    } catch {
      return null;
    }
  }

  async delete(companyId: string): Promise<void> {
    await this.redis.del(namespacedKey('graph', companyId), namespacedKey('meta', companyId));
  }
}
