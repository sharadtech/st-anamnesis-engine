import { Parser, Language } from 'web-tree-sitter';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

let initialized = false;

export async function ensureParser(): Promise<typeof Parser> {
  if (!initialized) {
    await Parser.init();
    initialized = true;
  }
  return Parser;
}

export async function resolveWasmPath(pkgName: string): Promise<string | undefined> {
  const candidates = [
    `${pkgName}.wasm`,
    `tree-sitter-${pkgName.split('-').pop()}.wasm`,
    `src/${pkgName}.wasm`,
  ];

  try {
    const resolver = (import.meta as { resolve?: (specifier: string) => string }).resolve;
    if (!resolver) throw new Error('import.meta.resolve is unavailable');
    const base = fileURLToPath(resolver(`${pkgName}/package.json`));
    const pkgDir = path.dirname(base);
    for (const c of candidates) {
      const p = path.join(pkgDir, c);
      try {
        await fs.access(p);
        return p;
      } catch {
        // try next candidate
      }
    }
  } catch {
    // package not resolvable
  }

  // Fallback: look next to node_modules from cwd
  const cwdFallback = path.resolve(process.cwd(), 'node_modules', pkgName);
  for (const c of candidates) {
    const p = path.join(cwdFallback, c);
    try {
      await fs.access(p);
      return p;
    } catch {
      // continue
    }
  }
  return undefined;
}

export async function loadLanguage(pkgName: string): Promise<Language | undefined> {
  await ensureParser();
  const wasmPath = await resolveWasmPath(pkgName);
  if (!wasmPath) return undefined;
  return Language.load(wasmPath);
}

export function createParser(language: Language): Parser {
  const parser = new Parser();
  parser.setLanguage(language);
  return parser;
}
