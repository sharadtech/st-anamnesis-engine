import Graph from 'graphology';
import type { ExtractionResult, GraphNode, GraphEdge, SerializedGraph, Confidence } from '../types/Extraction.js';
import type { VerificationReport } from '../verify/GraphVerifier.js';

export interface BuildGraphOptions {
  companyId: string;
  extraction: ExtractionResult;
}

export interface VerificationPatch {
  edgeId: string;
  real: boolean;
  updatedConfidence: Confidence;
  reason: string;
  severity: 'low' | 'medium' | 'high';
}

export function buildGraph(options: BuildGraphOptions): Graph {
  const { companyId, extraction } = options;

  const graph = new Graph({
    type: 'directed',
    multi: true,
    allowSelfLoops: false,
  });

  for (const node of extraction.nodes) {
    if (!graph.hasNode(node.id)) {
      graph.addNode(node.id, {
        label: node.label,
        kind: node.kind,
        sourceFile: node.sourceFile,
        sourceLocation: node.sourceLocation,
        confidence: node.confidence,
      });
    }
  }

  const seenEdges = new Set<string>();
  for (const edge of extraction.edges) {
    if (edge.source === edge.target) continue;
    if (!graph.hasNode(edge.source) || !graph.hasNode(edge.target)) continue;
    const signature = `${edge.source}->${edge.target}:${edge.relation}`;
    if (seenEdges.has(signature)) continue;
    seenEdges.add(signature);
    if (!graph.hasEdge(edge.id)) {
      graph.addEdgeWithKey(edge.id, edge.source, edge.target, {
        relation: edge.relation,
        confidence: edge.confidence,
        sourceFile: edge.sourceFile,
      });
    }
  }

  graph.setAttribute('companyId', companyId);
  return graph;
}

export function graphToSerialized(graph: Graph, companyId: string): SerializedGraph {
  const nodes: GraphNode[] = [];
  graph.forEachNode((id, attrs) => {
    nodes.push({
      id,
      label: attrs.label as string,
      kind: attrs.kind as GraphNode['kind'],
      sourceFile: attrs.sourceFile as string,
      sourceLocation: attrs.sourceLocation as GraphNode['sourceLocation'] | undefined,
      confidence: attrs.confidence as GraphNode['confidence'],
      community: attrs.community as number | undefined,
    });
  });

  const edges: GraphEdge[] = [];
  graph.forEachEdge((id, attrs, source, target) => {
    edges.push({
      id,
      source,
      target,
      relation: attrs.relation as GraphEdge['relation'],
      confidence: attrs.confidence as GraphEdge['confidence'],
      sourceFile: attrs.sourceFile as string,
    });
  });

  return {
    version: 1,
    companyId,
    builtAt: new Date().toISOString(),
    nodes,
    edges,
  };
}

export function serializedToGraph(serialized: SerializedGraph): Graph {
  const graph = buildGraph({
    companyId: serialized.companyId,
    extraction: { nodes: serialized.nodes, edges: serialized.edges },
  });
  return graph;
}

export function applyVerificationPatches(graph: SerializedGraph, patches: VerificationPatch[]): VerificationReport {
  const edgeIndex = new Map(graph.edges.map((e) => [e.id, e]));
  const kept: VerificationPatch[] = [];
  const rejected: VerificationPatch[] = [];
  let confidenceDelta = 0;

  for (const patch of patches) {
    const edge = edgeIndex.get(patch.edgeId);
    if (!edge) continue;

    if (!patch.real && patch.updatedConfidence === 'AMBIGUOUS') {
      rejected.push(patch);
      continue;
    }

    if (edge.confidence !== patch.updatedConfidence) {
      const order = rankConfidence(edge.confidence) - rankConfidence(patch.updatedConfidence);
      confidenceDelta += order;
      edge.confidence = patch.updatedConfidence;
    }
    kept.push(patch);
  }

  graph.edges = graph.edges.filter((e) => !rejected.some((p) => p.edgeId === e.id));

  const changes = [
    ...kept.map((p) => ({ edgeId: p.edgeId, reason: p.reason, severity: p.severity })),
    ...rejected.map((p) => ({
      edgeId: p.edgeId,
      reason: `Dropped: ${p.reason}`,
      severity: p.severity,
    })),
  ];

  return {
    verified: rejected.length === 0,
    confidenceDelta,
    changes,
  };
}

function rankConfidence(confidence: Confidence): number {
  switch (confidence) {
    case 'EXTRACTED':
      return 3;
    case 'INFERRED':
      return 2;
    case 'AMBIGUOUS':
      return 1;
    case 'INJECTED':
      return 0;
    default:
      return 0;
  }
}
