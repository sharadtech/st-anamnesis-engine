import { Queue } from 'bullmq';
import { redisConnectionOptions } from '../config/redis.js';

export const GRAPH_BUILD_QUEUE_NAME = 'graph-build';

export const graphBuildQueue = new Queue(GRAPH_BUILD_QUEUE_NAME, {
  connection: redisConnectionOptions,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { age: 24 * 3600, count: 1000 },
    removeOnFail: { age: 7 * 24 * 3600, count: 5000 },
  },
});
