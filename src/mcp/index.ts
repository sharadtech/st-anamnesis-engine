import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { GraphQueryService } from '../graph/GraphQueryService.js';
import { GraphRepository } from '../graph/GraphRepository.js';
import { registerGraphTools } from './tools.js';

export function createMcpServer(queryService?: GraphQueryService): McpServer {
  const service = queryService ?? new GraphQueryService(new GraphRepository());
  const server = new McpServer(
    { name: 'st-anamnesis-engine', version: '0.1.0' },
    { capabilities: { tools: {} } },
  );
  registerGraphTools(server, service);
  return server;
}
