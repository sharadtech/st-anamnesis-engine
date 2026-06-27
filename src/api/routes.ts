import type { FastifyPluginAsync } from 'fastify';
import type { Queue } from 'bullmq';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { GraphRepository } from '../graph/GraphRepository.js';
import type { GraphQueryService } from '../graph/GraphQueryService.js';
import { createMcpServer } from '../mcp/index.js';
import { Config } from '../config/Config.js';
import type { GraphBuildPayload } from '../types/Extraction.js';

export interface RoutesContext {
  queue: Queue<GraphBuildPayload>;
  repository: GraphRepository;
  queryService: GraphQueryService;
}

const buildRequestSchema = {
  body: {
    type: 'object',
    required: ['companyId', 'gitHubRepo'],
    properties: {
      companyId: { type: 'string', minLength: 1 },
      gitHubRepo: { type: 'string', format: 'uri' },
      gitUsername: { type: 'string' },
      gitPassword: { type: 'string' },
      filesToExclude: { type: 'array', items: { type: 'string' } },
      notifyUrl: { type: 'string', format: 'uri' },
      cleanWorkspace: { type: 'boolean' },
    },
  },
} as const;

export const routes: FastifyPluginAsync<RoutesContext> = async (fastify, ctx) => {
  fastify.get('/health', async () => ({ status: 'ok' }));

  fastify.post<{ Body: GraphBuildPayload }>('/graph/build', { schema: buildRequestSchema }, async (request, reply) => {
    const payload = request.body;
    const job = await ctx.queue.add('build', payload, {
      jobId: `${payload.companyId}-${Date.now()}`,
    });
    reply.status(202);
    return { status: 'queued', jobId: job.id };
  });

  fastify.get<{ Params: { jobId: string } }>('/status/:jobId', async (request, reply) => {
    const { jobId } = request.params;
    const job = await ctx.queue.getJob(jobId);
    if (!job) {
      reply.status(404);
      return { error: 'Job not found' };
    }

    const meta = job.data.companyId ? await ctx.repository.loadMeta(job.data.companyId) : null;
    return {
      jobId,
      state: await job.getState(),
      companyId: job.data.companyId,
      attemptsMade: job.attemptsMade,
      meta,
    };
  });

  if (Config.mcp.enabled) {
    fastify.all('/mcp', async (request, reply) => {
      const expectedKey = Config.mcp.apiKey;
      if (expectedKey) {
        const header = request.headers.authorization ?? '';
        const match = header.match(/^Bearer\s+(.+)$/i);
        if (!match || match[1] !== expectedKey) {
          reply.status(401);
          return { error: 'Unauthorized' };
        }
      }

      const mcpServer = createMcpServer(ctx.queryService);
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      await mcpServer.connect(transport);
      reply.hijack();
      await transport.handleRequest(request.raw, reply.raw, request.body);
      return;
    });
  }
};
