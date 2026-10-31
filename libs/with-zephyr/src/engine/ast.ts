import { langFromPath, parseSync, sourceTypeFromPath } from '@swc-next/parser';
import { createWalker } from '@swc-next/walker';
import fs from 'fs';

/**
 * Structural ESTree node as produced by @swc-next/parser. Only the fields this package
 * reads are declared; check `type` before relying on a field.
 */
export interface AstNode {
  type: string;
  start: number;
  end: number;
  alternate?: any;
  argument?: any;
  arguments?: any;
  body?: any;
  callee?: any;
  computed?: boolean;
  consequent?: any;
  declaration?: any;
  elements?: any;
  expression?: any;
  id?: any;
  imported?: any;
  importKind?: string;
  init?: any;
  key?: any;
  kind?: string;
  left?: any;
  local?: any;
  method?: boolean;
  name?: string;
  object?: any;
  operator?: string;
  param?: any;
  parameter?: any;
  params?: any;
  properties?: any;
  property?: any;
  right?: any;
  shorthand?: boolean;
  source?: any;
  specifiers?: any;
  test?: any;
  value?: any;
}

export interface TextEdit {
  start: number;
  end: number;
  text: string;
}

interface IndexState {
  nodes: AstNode[];
  parents: Map<AstNode, AstNode | null>;
}

// One pre-order pass records every node and its parent so later queries never re-walk.
const indexWalker = createWalker<IndexState>({
  enter(node, ctx) {
    ctx.state.nodes.push(node as AstNode);
    ctx.state.parents.set(node as AstNode, ctx.parent as AstNode | null);
  },
});

const FUNCTION_TYPES = new Set([
  'ArrowFunctionExpression',
  'FunctionExpression',
  'FunctionDeclaration',
]);

/** A parsed config file with parent links; positions are UTF-16 offsets into `source`. */
export class ParsedSource {
  readonly source: string;
  readonly program: AstNode;
  readonly nodes: AstNode[];
  private readonly parents: Map<AstNode, AstNode | null>;

  constructor(source: string, program: AstNode) {
    this.source = source;
    this.program = program;
    const state: IndexState = { nodes: [], parents: new Map() };
    indexWalker.walk(program as Parameters<typeof indexWalker.walk>[0], state);
    this.nodes = state.nodes;
    this.parents = state.parents;
  }

  text(node: AstNode | null | undefined): string {
    return node ? this.source.slice(node.start, node.end) : '';
  }

  parent(node: AstNode): AstNode | null {
    return this.parents.get(node) ?? null;
  }

  /** Ancestors ordered from the parent up to the program. */
  ancestors(node: AstNode): AstNode[] {
    const result: AstNode[] = [];
    for (let current = this.parent(node); current; current = this.parent(current)) {
      result.push(current);
    }
    return result;
  }

  /** All nodes of the given ESTree types, in document (pre-order) order. */
  ofType(...types: string[]): AstNode[] {
    return this.nodes.filter((node) => types.includes(node.type));
  }

  /**
   * Whether an Identifier is a binding or reference, not a property name. Mirrors
   * tree-sitter's `identifier` kind, which excludes member properties and object keys.
   */
  isReference(node: AstNode): boolean {
    if (node.type !== 'Identifier') return false;
    const parent = this.parent(node);
    if (!parent) return true;
    if (parent.type === 'MemberExpression')
      return parent.computed || parent.object === node;
    if (parent.type === 'Property') {
      if (parent.shorthand) return parent.value === node && !this.isObjectLiteral(parent);
      return parent.computed || parent.value === node;
    }
    if (
      parent.type === 'MethodDefinition' ||
      parent.type === 'PropertyDefinition' ||
      parent.type === 'TSPropertySignature'
    ) {
      return parent.computed || parent.key !== node;
    }
    return true;
  }

  private isObjectLiteral(property: AstNode): boolean {
    return this.parent(property)?.type === 'ObjectExpression';
  }
}

export function parseSource(source: string, filePath: string): ParsedSource {
  const result = parseSync(source, {
    lang: langFromPath(filePath),
    sourceType: sourceTypeFromPath(filePath),
    comments: 'none',
  });
  const error = result.diagnostics.find((diagnostic) => diagnostic.severity === 'error');
  if (error) {
    throw new Error(`Cannot parse ${filePath}: ${error.message}`);
  }
  return new ParsedSource(source, result.program as unknown as AstNode);
}

export function parseFile(filePath: string): ParsedSource {
  return parseSource(fs.readFileSync(filePath, 'utf8'), filePath);
}

/**
 * Apply edits in source order. Insertions at an offset land before a replacement starting
 * there; an edit overlapping an earlier replacement (e.g. a nested match) is dropped.
 */
export function applyEdits(source: string, edits: TextEdit[]): string {
  const width = (edit: TextEdit) => edit.end - edit.start;
  const ordered = [...edits].sort(
    (a, b) =>
      a.start - b.start ||
      Number(width(a) !== 0) - Number(width(b) !== 0) ||
      width(b) - width(a)
  );
  let output = '';
  let cursor = 0;
  for (const edit of ordered) {
    if (edit.start < cursor) continue;
    output += source.slice(cursor, edit.start) + edit.text;
    cursor = edit.end;
  }
  return output + source.slice(cursor);
}

export function isFunction(node: AstNode | null | undefined): boolean {
  return Boolean(node && FUNCTION_TYPES.has(node.type));
}

export function isIdentifier(node: AstNode | null | undefined, name?: string): boolean {
  return node?.type === 'Identifier' && (name === undefined || node.name === name);
}

export function isStringLiteral(node: AstNode | null | undefined): boolean {
  return node?.type === 'Literal' && typeof node.value === 'string';
}

/** Strip parentheses and `as` / `satisfies` assertions around an expression. */
export function unwrapExpression(node: AstNode | null | undefined): AstNode | null {
  let current = node ?? null;
  while (
    current &&
    (current.type === 'ParenthesizedExpression' ||
      current.type === 'TSAsExpression' ||
      current.type === 'TSSatisfiesExpression')
  ) {
    current = current.expression ?? null;
  }
  return current;
}

/** Static name of a non-computed `name:` / `"name":` key, or a computed `["name"]` key. */
export function propertyKeyName(property: AstNode): string | undefined {
  const key = property.key;
  if (!property.computed && isIdentifier(key)) return key.name;
  if (isStringLiteral(key)) return key.value;
  return undefined;
}

/** A plain `key: value` object property (not a method, accessor, or shorthand). */
export function isKeyValueProperty(node: AstNode, name?: string): boolean {
  return (
    node.type === 'Property' &&
    node.kind === 'init' &&
    !node.method &&
    !node.shorthand &&
    (name === undefined || propertyKeyName(node) === name)
  );
}

/** `module.exports` as written, without computed access. */
export function isModuleExports(node: AstNode | null | undefined): boolean {
  return Boolean(
    node?.type === 'MemberExpression' &&
    !node.computed &&
    isIdentifier(node.object, 'module') &&
    isIdentifier(node.property, 'exports')
  );
}

/** A `module.exports = value` assignment. */
export function isModuleExportsAssignment(node: AstNode | null | undefined): boolean {
  return Boolean(
    node?.type === 'AssignmentExpression' &&
    node.operator === '=' &&
    isModuleExports(node.left)
  );
}

/** Whether `callee` is the identifier or dotted member path `name` (e.g. `ns.helper`). */
export function isCalleePath(callee: AstNode | null | undefined, name: string): boolean {
  if (!callee) return false;
  const dot = name.lastIndexOf('.');
  if (dot === -1) return isIdentifier(callee, name);
  return (
    callee.type === 'MemberExpression' &&
    !callee.computed &&
    isIdentifier(callee.property, name.slice(dot + 1)) &&
    isCalleePath(callee.object, name.slice(0, dot))
  );
}

export function isCallTo(node: AstNode | null | undefined, name: string): boolean {
  return node?.type === 'CallExpression' && isCalleePath(node.callee, name);
}

/** Text spanning a list of nodes, from the first start to the last end (holes ignored). */
export function sliceList(parsed: ParsedSource, nodes: (AstNode | null)[]): string {
  const present = nodes.filter((node): node is AstNode => Boolean(node));
  if (present.length === 0) return '';
  return parsed.source.slice(present[0].start, present.at(-1)!.end);
}

/** Whether an array/object literal ends with a trailing comma before its closing bracket. */
export function hasTrailingComma(
  parsed: ParsedSource,
  container: AstNode,
  items: (AstNode | null)[]
): boolean {
  const last = items.at(-1);
  if (items.length === 0) return false;
  if (!last) return true;
  const between = parsed.source
    .slice(last.end, container.end - 1)
    .replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
  return between.includes(',');
}
