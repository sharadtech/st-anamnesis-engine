import fs from 'fs/promises';
import path from 'path';
import OpenAI from 'openai';

import type { SerializedGraph } from '../types/Extraction.js';
import type { GraphVerifier, VerificationReport } from './GraphVerifier.js';
import { Config } from '../config/Config.js';
import { applyVerificationPatches, type VerificationPatch } from '../graph/GraphBuilder.js';
import {
  PromptBuilder,
  AUDIT_RESPONSE_SCHEMA,
  compileAuditSample,
  type AuditSample,
  type FileSnippet,
} from './PromptBuilder.js';

export class OpenAiVerifier implements GraphVerifier {
  readonly name = 'openai';
  private readonly client: OpenAI;

  constructor() {
    if (!Config.verifier.apiKey) {
      throw new Error('OpenAiVerifier requires OPENAI_API_KEY');
    }

    this.client = new OpenAI({
      apiKey: Config.verifier.apiKey,
      baseURL: Config.verifier.baseUrl,
      timeout: Config.verifier.timeoutMs,
      maxRetries: 2,
    });
  }

  async verify(repoPath: string, graph: SerializedGraph): Promise<VerificationReport> {
    try {
      const samples = await pickSamples(repoPath, graph, Config.verifier.sampleSize, Config.verifier.snippetLines);
      if (samples.length === 0) {
        return { verified: true, confidenceDelta: 0, changes: [] };
      }

      const messages = PromptBuilder.buildAuditMessages(samples);
      const response = await this.client.chat.completions.create({
        model: Config.verifier.model,
        messages,
        response_format: { type: 'json_schema', json_schema: AUDIT_RESPONSE_SCHEMA },
        temperature: 0.1,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('OpenAI returned empty content');
      }

      const verdicts = PromptBuilder.parseVerdicts(content);
      const patches: VerificationPatch[] = verdicts.map((v) => ({
        edgeId: v.edgeId,
        real: v.real,
        updatedConfidence: v.updatedConfidence,
        reason: v.reason,
        severity: v.severity,
      }));

      return applyVerificationPatches(graph, patches);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        verified: false,
        confidenceDelta: 0,
        changes: [{ reason: `Verifier error: ${message}`, severity: 'high' }],
      };
    }
  }
}

async function pickSamples(
  repoPath: string,
  graph: SerializedGraph,
  sampleSize: number,
  snippetLines: number,
): Promise<AuditSample[]> {
  const nodeIndex = new Map(graph.nodes.map((n) => [n.id, n]));
  const candidateEdges = graph.edges.filter((e) => e.confidence === 'INFERRED' || e.confidence === 'AMBIGUOUS');

  const edgesToAudit = candidateEdges.slice(0, sampleSize);
  const samples: AuditSample[] = [];

  for (const edge of edgesToAudit) {
    const line = (edge.sourceLocation as { line?: number } | undefined)?.line;
    const snippet = await readSnippet(repoPath, edge.sourceFile, line, snippetLines);
    samples.push(compileAuditSample(edge, nodeIndex, snippet));
  }

  return samples;
}

async function readSnippet(
  repoPath: string,
  sourceFile: string,
  centerLine: number | undefined,
  snippetLines: number,
): Promise<FileSnippet | undefined> {
  const filePath = path.resolve(repoPath, sourceFile);
  if (!filePath.startsWith(path.resolve(repoPath))) {
    return undefined;
  }

  let content: string;
  try {
    content = await fs.readFile(filePath, 'utf-8');
  } catch {
    return undefined;
  }

  const lines = content.split('\n');
  const totalLines = lines.length;
  if (totalLines === 0) return undefined;

  let startLine: number;
  let endLine: number;
  if (centerLine === undefined || centerLine < 1) {
    startLine = 1;
    endLine = Math.min(snippetLines, totalLines);
  } else {
    const half = Math.floor(snippetLines / 2);
    startLine = Math.max(1, centerLine - half);
    endLine = Math.min(totalLines, startLine + snippetLines - 1);
    startLine = Math.max(1, endLine - snippetLines + 1);
  }

  const text = lines.slice(startLine - 1, endLine).join('\n');
  return { filePath: sourceFile, startLine, endLine, text };
}
