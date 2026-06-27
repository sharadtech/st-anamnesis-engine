import type { GraphEdge } from '../types/Extraction.js';
import type { VerificationChange } from './GraphVerifier.js';

export interface FileSnippet {
  filePath: string;
  startLine: number;
  endLine: number;
  text: string;
}

export interface AuditSample {
  edgeId: string;
  sourceId: string;
  sourceLabel: string;
  targetId: string;
  targetLabel: string;
  relation: string;
  confidence: string;
  sourceFile: string;
  snippet?: FileSnippet;
}

export interface Verdict {
  edgeId: string;
  real: boolean;
  updatedConfidence: 'EXTRACTED' | 'INFERRED' | 'AMBIGUOUS';
  reason: string;
  severity: 'low' | 'medium' | 'high';
}

export const AUDIT_RESPONSE_SCHEMA = {
  name: 'graph_verdicts',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      verdicts: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            edgeId: { type: 'string' },
            real: { type: 'boolean' },
            updatedConfidence: { type: 'string', enum: ['EXTRACTED', 'INFERRED', 'AMBIGUOUS'] },
            reason: { type: 'string' },
            severity: { type: 'string', enum: ['low', 'medium', 'high'] },
          },
          required: ['edgeId', 'real', 'updatedConfidence', 'reason', 'severity'],
          additionalProperties: false,
        },
      },
    },
    required: ['verdicts'],
    additionalProperties: false,
  },
};

export const PromptBuilder = {
  buildAuditMessages(samples: AuditSample[]) {
    return [
      {
        role: 'system' as const,
        content:
          'You are a code-graph verification assistant. You are given a set of candidate relationships extracted from source code. ' +
          'Each relationship has a confidence of INFERRED or AMBIGUOUS. ' +
          'Using the provided source-file snippet, decide whether the relationship is real. ' +
          'Return a verdict for every edgeId exactly as provided. ' +
          'If the relationship is supported by the snippet, set real=true and updatedConfidence=EXTRACTED. ' +
          'If the relationship is unsupported but plausible, set real=true and updatedConfidence=INFERRED. ' +
          'If the relationship is clearly wrong, set real=false and updatedConfidence=AMBIGUOUS.',
      },
      {
        role: 'user' as const,
        content: JSON.stringify({
          samples: samples.map((s) => ({
            edgeId: s.edgeId,
            sourceLabel: s.sourceLabel,
            relation: s.relation,
            targetLabel: s.targetLabel,
            confidence: s.confidence,
            sourceFile: s.sourceFile,
            snippet: s.snippet
              ? { filePath: s.snippet.filePath, lines: `${s.snippet.startLine}-${s.snippet.endLine}`, text: s.snippet.text }
              : undefined,
          })),
        }),
      },
    ];
  },

  parseVerdicts(responseText: string): Verdict[] {
    const parsed = JSON.parse(responseText) as { verdicts?: unknown[] };
    if (!Array.isArray(parsed.verdicts)) {
      throw new Error('Missing verdicts array in verifier response');
    }
    return parsed.verdicts.map((v) => {
      const item = v as Record<string, unknown>;
      return {
        edgeId: String(item.edgeId ?? ''),
        real: Boolean(item.real),
        updatedConfidence: validateConfidence(item.updatedConfidence),
        reason: String(item.reason ?? ''),
        severity: validateSeverity(item.severity),
      };
    });
  },

  verdictsToChanges(verdicts: Verdict[], samples: AuditSample[]): VerificationChange[] {
    const sampleIndex = new Map(samples.map((s) => [s.edgeId, s]));
    return verdicts.map<VerificationChange>((v) => {
      const sample = sampleIndex.get(v.edgeId);
      return {
        edgeId: v.edgeId,
        nodeId: sample?.sourceId,
        reason: v.reason,
        severity: v.severity,
      };
    });
  },
};

function validateConfidence(value: unknown): Verdict['updatedConfidence'] {
  if (value === 'EXTRACTED' || value === 'INFERRED' || value === 'AMBIGUOUS') return value;
  throw new Error(`Invalid updatedConfidence value: ${String(value)}`);
}

function validateSeverity(value: unknown): VerificationChange['severity'] {
  if (value === 'low' || value === 'medium' || value === 'high') return value;
  throw new Error(`Invalid severity value: ${String(value)}`);
}

export function compileAuditSample(edge: GraphEdge, nodeIndex: Map<string, { label: string }>, snippet?: FileSnippet): AuditSample {
  const sourceNode = nodeIndex.get(edge.source);
  const targetNode = nodeIndex.get(edge.target);
  return {
    edgeId: edge.id,
    sourceId: edge.source,
    sourceLabel: sourceNode?.label ?? edge.source,
    targetId: edge.target,
    targetLabel: targetNode?.label ?? edge.target,
    relation: edge.relation,
    confidence: edge.confidence,
    sourceFile: edge.sourceFile,
    snippet,
  };
}
