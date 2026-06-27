import type { Extractor, ExtractorContext, ExtractionResult } from '../Extractor.js';

export const sightlyExtractor: Extractor = {
  id: 'sightly',
  name: 'AEM Sightly (HTL)',
  extensions: ['html', 'htm'],

  async extract(source: string, ctx: ExtractorContext): Promise<ExtractionResult> {
    const nodes: ExtractionResult['nodes'] = [];
    const edges: ExtractionResult['edges'] = [];
    const fileId = ctx.sourceFile;

    nodes.push({
      id: fileId,
      label: fileId.split('/').pop() || fileId,
      kind: 'file',
      sourceFile: fileId,
      sourceLocation: { file: fileId, line: 1, column: 1 },
      confidence: 'EXTRACTED',
    });

    const lines = source.split('\n');
    const dataSlyRegex = /\s(data-sly-[a-zA-Z0-9\-._]+)="([^"]*)"/g;
    const expressionRegex = /\$\{([^}]+)\}/g;
    const blockRegex = /<sly\s+([^>]*)\/>|<sly\s+([^>]*)>/g;

    const addNode = (kind: 'expression' | 'attribute' | 'tag', label: string, lineNum: number): string => {
      const id = `${fileId}#${kind}:${label}:${lineNum}`;
      if (!nodes.some((n) => n.id === id)) {
        nodes.push({
          id,
          label,
          kind,
          sourceFile: fileId,
          sourceLocation: { file: fileId, line: lineNum, column: 1 },
          confidence: 'EXTRACTED',
        });
      }
      return id;
    };

    const addEdge = (source: string, target: string) => {
      edges.push({
        id: `${source}->${target}:uses:${edges.length}`,
        source,
        target,
        relation: 'uses',
        confidence: 'EXTRACTED',
        sourceFile: fileId,
      });
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      const dataSlyLine = [...line.matchAll(dataSlyRegex)];
      for (const match of dataSlyLine) {
        const attrName = match[1];
        const attrValue = match[2];
        const id = addNode('attribute', attrName, lineNum);
        addEdge(fileId, id);

        let em: RegExpExecArray | null;
        while ((em = expressionRegex.exec(attrValue)) !== null) {
          const expr = em[1].trim();
          const exprId = addNode('expression', expr.slice(0, 80), lineNum);
          addEdge(id, exprId);
        }
      }

      const blockMatches = [...line.matchAll(blockRegex)];
      for (const match of blockMatches) {
        const attrs = match[1] || match[2] || '';
        const tagId = addNode('tag', `<sly>`, lineNum);
        addEdge(fileId, tagId);

        let em: RegExpExecArray | null;
        while ((em = expressionRegex.exec(attrs)) !== null) {
          const expr = em[1].trim();
          const exprId = addNode('expression', expr.slice(0, 80), lineNum);
          addEdge(tagId, exprId);
        }
      }

      let em: RegExpExecArray | null;
      while ((em = expressionRegex.exec(line)) !== null) {
        const expr = em[1].trim();
        const exprId = addNode('expression', expr.slice(0, 80), lineNum);
        addEdge(fileId, exprId);
      }
    }

    return { nodes, edges };
  },
};
