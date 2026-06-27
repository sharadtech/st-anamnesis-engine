import { Worker } from 'bullmq';

import { Config } from './config/Config.js';
import { redisConnectionOptions } from './config/redis.js';
import { GraphRepository } from './graph/GraphRepository.js';
import { GRAPH_BUILD_QUEUE_NAME, graphBuildQueue } from './queue/Queue.js';
import { createGraphBuildProcessor } from './queue/GraphBuildProcessor.js';
import { NoopVerifier } from './verify/NoopVerifier.js';
import { OpenAiVerifier } from './verify/OpenAiVerifier.js';
import { VerificationRepository } from './verify/VerificationRepository.js';

// Required side-effect: registers all grammar extractors.
import './extract/grammars/index.js';

async function main() {
  const repository = new GraphRepository();
  const verificationRepository = new VerificationRepository();
  const verifier = Config.verifier.enabled && Config.verifier.apiKey ? new OpenAiVerifier() : new NoopVerifier();
  const processor = createGraphBuildProcessor({ repository, verifier, verificationRepository });

  const worker = new Worker(GRAPH_BUILD_QUEUE_NAME, processor, {
    connection: redisConnectionOptions,
    concurrency: Config.worker.concurrency,
    lockDuration: Config.worker.buildTimeoutMs,
  });

  worker.on('completed', (job) => {
    console.log(`[worker] completed job ${job.id} for ${job.data.companyId}`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[worker] failed job ${job?.id}:`, err);
  });

  console.log(`[worker] started (concurrency=${Config.worker.concurrency})`);

  async function shutdown(signal: string) {
    console.log(`[worker] received ${signal}, shutting down...`);
    await worker.close();
    await graphBuildQueue.close();
    process.exit(0);
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('[worker] fatal error:', err);
  process.exit(1);
});
