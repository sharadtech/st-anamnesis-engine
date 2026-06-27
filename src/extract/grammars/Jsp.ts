import type { Extractor, ExtractorContext, ExtractionResult } from '../Extractor.js';

export const jspExtractor: Extractor = {
  id: 'jsp',
  name: 'JSP',
  extensions: ['jsp', 'jspx', 'tag'],

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

    const addNode = (kind: 'tag' | 'scriptlet' | 'import', label: string, lineNum: number): string => {
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

    const addEdge = (source: string, target: string, relation: 'contains' | 'imports' | 'uses' | 'references') => {
      edges.push({
        id: `${source}->${target}:${relation}:${edges.length}`,
        source,
        target,
        relation,
        confidence: 'EXTRACTED',
        sourceFile: fileId,
      });
    };

    for (const m of source.matchAll(/<%@\s+taglib\s+[^>]*prefix="([^"]*)"[^>]*uri="([^"]*)"[^>]*%>/g)) {
      const lineNum = source.slice(0, m.index).split('\n').length;
      const id = addNode('import', `taglib:${m[2]}`, lineNum);
      addEdge(fileId, id, 'imports');
    }

    for (const m of source.matchAll(/<%@\s+(page|include|taglib)\s+([^%]+)%>/g)) {
      const lineNum = source.slice(0, m.index).split('\n').length;
      const directive = m[1];
      const content = m[2].trim();
      if (directive === 'include' || directive === 'page') {
        const id = addNode('import', `${directive}:${content}`, lineNum);
        addEdge(fileId, id, 'imports');
      }
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      for (const match of line.matchAll(/<%(!|=|[-#])?\s*([\s\S]*?)\s*%>/g)) {
        const body = match[2] || '<scriptlet>';
        const label = body.slice(0, 80).replace(/\s+/g, ' ').trim();
        const id = addNode('scriptlet', label || '<scriptlet>', lineNum);
        addEdge(fileId, id, 'contains');
      }

      const taglibUse = line.match(/<([a-zA-Z0-9_-]+):([a-zA-Z0-9_-]+)/g);
      if (taglibUse) {
        for (const use of taglibUse) {
          const id = addNode('tag', use.slice(1), lineNum);
          addEdge(fileId, id, 'uses');
        }
      }

      for (const match of line.matchAll(/\$\{([^}]+)\}/g)) {
        const expr = match[1].trim();
        const id = addNode('scriptlet', `el:${expr.slice(0, 60)}`, lineNum);
        addEdge(fileId, id, 'references');
      }
    }

    return { nodes, edges };
  },
};
