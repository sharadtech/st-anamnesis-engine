import fs from 'fs/promises';
import path from 'path';
import { globalExtractorRegistry, type ExtractorContext, type ExtractionResult } from './Extractor.js';
import { sightlyExtractor } from './grammars/Sightly.js';

export interface ExtractFileOptions {
  repoRoot: string;
  filePath: string;
  filesToExclude?: string[];
}

function isExcluded(relativePath: string, patterns: string[]): boolean {
  return patterns.some((pattern) => {
    const normalized = pattern.replace(/\/$/, '');
    return relativePath === normalized ||
      relativePath.startsWith(`${normalized}/`) ||
      relativePath.includes(`/${normalized}/`);
  });
}

function isBinaryFile(source: string): boolean {
  // quick heuristic: null bytes in the first 1024 bytes
  const sample = source.slice(0, 1024);
  return sample.includes('\0');
}

function looksLikeSightly(source: string): boolean {
  return /\bdata-sly-/.test(source) || /<sly\b/.test(source);
}

export async function extractFile(options: ExtractFileOptions): Promise<ExtractionResult> {
  const { repoRoot, filePath, filesToExclude = [] } = options;
  const relativePath = path.relative(repoRoot, filePath).replace(/\\/g, '/');

  if (isExcluded(relativePath, filesToExclude)) {
    return { nodes: [], edges: [] };
  }

  const ext = path.extname(filePath).slice(1).toLowerCase();
  let extractor = globalExtractorRegistry.getForExtension(ext);
  if (!extractor) {
    return { nodes: [], edges: [] };
  }

  let source: string;
  try {
    source = await fs.readFile(filePath, 'utf-8');
  } catch {
    return { nodes: [], edges: [] };
  }

  if (isBinaryFile(source)) {
    return { nodes: [], edges: [] };
  }

  // HTML files may be AEM Sightly templates: prefer sightly when detected.
  if (ext === 'html' || ext === 'htm') {
    if (looksLikeSightly(source)) {
      extractor = sightlyExtractor;
    }
  }

  const ctx: ExtractorContext = {
    sourceFile: relativePath,
    repoRoot,
  };

  return extractor.extract(source, ctx);
}

export async function extractRepo(repoRoot: string, filesToExclude: string[] = []): Promise<ExtractionResult> {
  const results: ExtractionResult[] = [];

  async function walk(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '.git' || entry.name === 'node_modules') continue;
        await walk(fullPath);
      } else if (entry.isFile()) {
        results.push(await extractFile({ repoRoot, filePath: fullPath, filesToExclude }));
      }
    }
  }

  await walk(repoRoot);

  const nodes: ExtractionResult['nodes'] = [];
  const edges: ExtractionResult['edges'] = [];
  for (const r of results) {
    nodes.push(...r.nodes);
    edges.push(...r.edges);
  }
  return { nodes, edges };
}
