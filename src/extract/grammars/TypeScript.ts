import { TreeSitterExtractor } from '../treeSitter.js';

export const typeScriptExtractor = new TreeSitterExtractor({
  id: 'typescript',
  name: 'TypeScript',
  extensions: ['ts', 'tsx'],
  grammarPkg: 'tree-sitter-typescript',
  nodeConfig: {
    function: ['function_declaration', 'function_expression', 'arrow_function', 'generator_function_declaration'],
    class: ['class_declaration', 'abstract_class_declaration'],
    interface: ['interface_declaration', 'type_alias_declaration'],
    method: ['method_definition', 'method_signature'],
    import: ['import_statement', 'import_declaration'],
    call: ['call_expression'],
  },
});
