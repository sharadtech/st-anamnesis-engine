import type { SerializedGraph } from '../types/Extraction.js';

export interface VerificationChange {
  nodeId?: string;
  edgeId?: string;
  reason: string;
  severity: 'low' | 'medium' | 'high';
}

export interface VerificationReport {
  verified: boolean;
  confidenceDelta: number;
  changes: VerificationChange[];
}

export interface GraphVerifier {
  readonly name: string;
  verify(repoPath: string, graph: SerializedGraph): Promise<VerificationReport>;
}
