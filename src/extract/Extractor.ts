import type { ExtractionResult } from '../types/Extraction.js';

export type { ExtractionResult } from '../types/Extraction.js';

export interface ExtractorContext {
  sourceFile: string;
  repoRoot: string;
}

export interface Extractor {
  readonly id: string;
  readonly name: string;
  readonly extensions: readonly string[];
  extract(source: string, context: ExtractorContext): Promise<ExtractionResult>;
}

export class ExtractorRegistry {
  private readonly extractors = new Map<string, Extractor>();

  register(...extractors: Extractor[]): void {
    for (const ex of extractors) {
      if (this.extractors.has(ex.id)) {
        throw new Error(`Extractor ${ex.id} is already registered`);
      }
      this.extractors.set(ex.id, ex);
    }
  }

  getForExtension(ext: string): Extractor | undefined {
    const normalized = ext.startsWith('.') ? ext.slice(1).toLowerCase() : ext.toLowerCase();
    for (const extractor of this.extractors.values()) {
      if (extractor.extensions.includes(normalized)) return extractor;
    }
    return undefined;
  }

  list(): Extractor[] {
    return Array.from(this.extractors.values());
  }
}

export const globalExtractorRegistry = new ExtractorRegistry();
