export type EntityKind =
  | 'file'
  | 'class'
  | 'interface'
  | 'function'
  | 'method'
  | 'variable'
  | 'import'
  | 'export'
  | 'tag'
  | 'attribute'
  | 'scriptlet'
  | 'expression'
  | 'module'
  | 'comment'
  | 'concept';

export type RelationType =
  | 'contains'
  | 'defines'
  | 'imports'
  | 'exports'
  | 'extends'
  | 'implements'
  | 'calls'
  | 'uses'
  | 'references'
  | 'attribute_of'
  | 'child_of'
  | 'has_scriptlet';

export type Confidence = 'EXTRACTED' | 'INFERRED' | 'AMBIGUOUS' | 'INJECTED';

export interface SourceLocation {
  file: string;
  line: number;
  column: number;
}

export interface GraphNode {
  id: string;
  label: string;
  kind: EntityKind;
  sourceFile: string;
  sourceLocation?: SourceLocation;
  confidence: Confidence;
  community?: number;
  [key: string]: unknown;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relation: RelationType;
  confidence: Confidence;
  sourceFile: string;
  [key: string]: unknown;
}

export interface ExtractionResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface SerializedGraph {
  version: 1;
  companyId: string;
  builtAt: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphMeta {
  companyId: string;
  state: 'queued' | 'active' | 'completed' | 'failed';
  jobId?: string;
  nodes: number;
  edges: number;
  communities: number;
  gitCommit?: string;
  error?: string;
  verified?: boolean;
  updatedAt: string;
}

export interface GraphBuildPayload {
  companyId: string;
  gitHubRepo: string;
  gitUsername?: string;
  gitPassword?: string;
  filesToExclude?: string[];
  notifyUrl?: string;
  cleanWorkspace?: boolean;
}
