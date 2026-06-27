import Fastify from 'fastify';

import { Config } from './config/Config.js';
import { createRedisClient } from './config/redis.js';
import { GraphRepository } from './graph/GraphRepository.js';
import { GraphQueryService } from './graph/GraphQueryService.js';
import { graphBuildQueue } from './queue/Queue.js';
import { routes } from './api/routes.js';

// Warm up the grammar registry so extractor plugins are registered.
// This import is needed even though the API process does not extract files itself.
import './extract/grammars/index.js';

async function main() {
  const redis = createRedisClient();
  const repository = new GraphRepository(redis);
  const queryService = new GraphQueryService(repository);

  const app = Fastify({
    logger: { level: 'info' },
  });

  await app.register(routes, {
    queue: graphBuildQueue,
    repository,
    queryService,
  });

  try {
    await app.listen({ host: Config.api.host, port: Config.api.port });
    app.log.info(`API listening on ${Config.api.host}:${Config.api.port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
