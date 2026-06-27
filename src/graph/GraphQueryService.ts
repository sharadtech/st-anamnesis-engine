import { bidirectional } from 'graphology-shortest-path';
import Graph from 'graphology';
import { GraphRepository } from './GraphRepository.js';
import { serializedToGraph } from './GraphBuilder.js';

export interface QueryOptions {
  depth?: number;
  budget?: number;
  mode?: 'bfs' | 'dfs';
}

interface ScoredNode {
  id: string;
  label: string;
  score: number;
}

export class GraphQueryService {
  constructor(private readonly repository: GraphRepository) {}

  async findNode(companyId: string, query: string): Promise<ScoredNode | null> {
    const graph = await this.loadGraph(companyId);
    if (!graph) return null;

    const terms = tokenize(query);
    let best: ScoredNode | null = null;
    let bestScore = 0;

    graph.forEachNode((id, attrs) => {
      const label: string = (attrs.label as string) ?? '';
      const sourceFile: string = (attrs.sourceFile as string) ?? '';
      const text = `${label} ${sourceFile}`.toLowerCase();
      let score = 0;
      for (const term of terms) {
        if (label.toLowerCase() === term) score += 10;
        else if (label.toLowerCase().includes(term)) score += 5;
        else if (text.includes(term)) score += 1;
      }
      if (score > bestScore) {
        bestScore = score;
        best = { id, label, score };
      }
    });

    return best;
  }

  async subgraphText(companyId: string, seedQuery: string, options: QueryOptions = {}): Promise<string> {
    const { depth = 2, budget = 2000, mode: _mode } = options;
    const graph = await this.loadGraph(companyId);
    if (!graph) return '';

    const seed = await this.findNode(companyId, seedQuery);
    if (!seed) return `No node matched "${seedQuery}".`;

    const visited = new Set<string>([seed.id]);
    const queue: Array<{ id: string; d: number }> = [{ id: seed.id, d: 0 }];
    const edgeIds: string[] = [];

    while (queue.length > 0) {
      const { id, d } = queue.shift()!;
      if (d >= depth) continue;

      const edges = graph.outEdges(id);
      for (const edgeId of edges) {
        const target = graph.target(edgeId);
        if (!visited.has(target)) {
          visited.add(target);
          queue.push({ id: target, d: d + 1 });
        }
        edgeIds.push(edgeId);
      }
    }

    return this.renderSubgraph(graph, Array.from(visited), edgeIds, budget);
  }

  async getNeighbors(companyId: string, query: string, depth = 1): Promise<string> {
    const graph = await this.loadGraph(companyId);
    if (!graph) return '';

    const seed = await this.findNode(companyId, query);
    if (!seed) return `No node matched "${query}".`;

    const visited = new Set<string>([seed.id]);
    let frontier = new Set<string>([seed.id]);
    const lines: string[] = [`Neighbors of ${seed.label} (${depth} hop${depth === 1 ? '' : 's'}):`];

    for (let d = 0; d < depth && frontier.size > 0; d++) {
      const nextFrontier = new Set<string>();
      for (const id of frontier) {
        for (const edgeId of graph.outEdges(id)) {
          const target = graph.target(edgeId);
          const relation = graph.getEdgeAttribute(edgeId, 'relation') as string;
          const targetLabel = graph.getNodeAttribute(target, 'label') as string;
          lines.push(`  ${id} --${relation}--> ${targetLabel} [${target}]`);
          if (!visited.has(target)) {
            visited.add(target);
            nextFrontier.add(target);
          }
        }
      }
      frontier = nextFrontier;
    }

    if (lines.length === 1) lines.push('  (no outgoing edges)');
    return lines.join('\n');
  }

  async graphStats(companyId: string): Promise<string> {
    const meta = await this.repository.loadMeta(companyId);
    if (!meta) return `No graph metadata found for companyId=${companyId}.`;
    return [
      `Graph stats for ${companyId}:`,
      `  state: ${meta.state}`,
      `  nodes: ${meta.nodes}`,
      `  edges: ${meta.edges}`,
      `  communities: ${meta.communities}`,
      `  verified: ${meta.verified ?? false}`,
      meta.gitCommit ? `  gitCommit: ${meta.gitCommit}` : '',
      `  updatedAt: ${meta.updatedAt}`,
    ]
      .filter(Boolean)
      .join('\n');
  }

  async shortestPath(companyId: string, sourceQuery: string, targetQuery: string): Promise<string> {
    const graph = await this.loadGraph(companyId);
    if (!graph) return '';

    const sourceNode = await this.findNode(companyId, sourceQuery);
    const targetNode = await this.findNode(companyId, targetQuery);
    if (!sourceNode) return `No node matched "${sourceQuery}".`;
    if (!targetNode) return `No node matched "${targetQuery}".`;

    try {
      const path = bidirectional(graph, sourceNode.id, targetNode.id);
      if (!path || path.length === 0) return `No path between ${sourceNode.label} and ${targetNode.label}.`;
      return [
        `Path (${path.length} nodes):`,
        ...path.map((id) => {
          const label = graph.getNodeAttribute(id, 'label') as string;
          return `  ${label} [${id}]`;
        }),
      ].join('\n');
    } catch {
      return `No path between ${sourceNode.label} and ${targetNode.label}.`;
    }
  }

  private async loadGraph(companyId: string): Promise<Graph | null> {
    const serialized = await this.repository.loadGraph(companyId);
    if (!serialized) return null;
    return serializedToGraph(serialized);
  }

  private renderSubgraph(
    graph: Graph,
    nodeIds: string[],
    edgeIds: string[],
    budget: number,
  ): string {
    let used = 0;
    const lines: string[] = [];
    lines.push('Nodes:');

    for (const id of nodeIds) {
      const label = graph.getNodeAttribute(id, 'label') as string;
      const kind = graph.getNodeAttribute(id, 'kind') as string;
      const community = graph.getNodeAttribute(id, 'community') as number | undefined;
      const line = `  ${label} [${kind}${community !== undefined ? `, community ${community}` : ''}]`;
      if (used + line.length > budget) break;
      lines.push(line);
      used += line.length + 1;
    }

    if (used < budget && edgeIds.length > 0) {
      lines.push('Edges:');
      for (const edgeId of edgeIds) {
        const source = graph.source(edgeId);
        const target = graph.target(edgeId);
        const relation = graph.getEdgeAttribute(edgeId, 'relation') as string;
        const line = `  ${source} --${relation}--> ${target}`;
        if (used + line.length > budget) {
          lines.push('  ... (truncated)');
          break;
        }
        lines.push(line);
        used += line.length + 1;
      }
    }

    return lines.join('\n');
  }
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9_]+/)
    .filter((t) => t.length > 0);
}
