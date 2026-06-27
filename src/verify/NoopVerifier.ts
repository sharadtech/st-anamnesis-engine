import type { GraphVerifier, VerificationReport } from './GraphVerifier.js';
import type { SerializedGraph } from '../types/Extraction.js';

export class NoopVerifier implements GraphVerifier {
  readonly name = 'noop';

  async verify(_repoPath: string, _graph: SerializedGraph): Promise<VerificationReport> {
    return { verified: true, confidenceDelta: 0, changes: [] };
  }
}
