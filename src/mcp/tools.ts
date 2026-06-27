import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { GraphQueryService } from '../graph/GraphQueryService.js';

const CompanyIdSchema = z.object({
  companyId: z.string().min(1),
});

export function registerGraphTools(server: McpServer, queryService: GraphQueryService): void {
  server.registerTool(
    'query_graph',
    {
      description: 'Return a concise subgraph traversal (BFS/DFS) around nodes matching the question.',
      inputSchema: CompanyIdSchema.extend({
        question: z.string().min(1),
        depth: z.number().int().min(1).max(5).optional(),
        budget: z.number().int().min(100).max(10_000).optional(),
        mode: z.enum(['bfs', 'dfs']).optional(),
      }),
    },
    async (args) => {
      const text = await queryService.subgraphText(args.companyId, args.question, {
        depth: args.depth,
        budget: args.budget,
        mode: args.mode,
      });
      return { content: [{ type: 'text', text }] };
    },
  );

  server.registerTool(
    'get_node',
    {
      description: 'Find the single best-matching node for a free-text query.',
      inputSchema: CompanyIdSchema.extend({
        query: z.string().min(1),
      }),
    },
    async (args) => {
      const node = await queryService.findNode(args.companyId, args.query);
      const text = node
        ? `Matched node: ${node.label} [${node.id}] (score=${node.score})`
        : `No node matched "${args.query}".`;
      return { content: [{ type: 'text', text }] };
    },
  );

  server.registerTool(
    'get_neighbors',
    {
      description: 'List directed outgoing neighbors of the node matching the query.',
      inputSchema: CompanyIdSchema.extend({
        query: z.string().min(1),
        depth: z.number().int().min(1).max(3).optional(),
      }),
    },
    async (args) => {
      const text = await queryService.getNeighbors(args.companyId, args.query, args.depth);
      return { content: [{ type: 'text', text }] };
    },
  );

  server.registerTool(
    'shortest_path',
    {
      description: 'Return a shortest directed path between two node queries.',
      inputSchema: CompanyIdSchema.extend({
        source: z.string().min(1),
        target: z.string().min(1),
      }),
    },
    async (args) => {
      const text = await queryService.shortestPath(args.companyId, args.source, args.target);
      return { content: [{ type: 'text', text }] };
    },
  );

  server.registerTool(
    'graph_stats',
    {
      description: 'Report node, edge, and community counts from the persisted graph metadata.',
      inputSchema: CompanyIdSchema,
    },
    async (args) => {
      const text = await queryService.graphStats(args.companyId);
      return { content: [{ type: 'text', text }] };
    },
  );
}
