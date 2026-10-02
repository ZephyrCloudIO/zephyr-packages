import { parse, type ParserPlugin } from '@babel/parser';
import MagicString, { type SourceMap } from 'magic-string';

export interface NativeEnvRewriteOptions {
  /** Source file path; selects parser plugins and names the source map source. */
  filename: string;
  /** Zephyr application UID that scopes runtime overrides. */
  applicationUid: string;
  /** Build-time `ZE_PUBLIC_*` values compiled in as fallbacks. */
  buildEnv: Readonly<Record<string, string>>;
}

/** Babel AST node; parsed nodes always carry source offsets. */
interface AstNode {
  type: string;
  start: number;
  end: number;
  [key: string]: unknown;
}

const PUBLIC_KEY = /^ZE_PUBLIC_[A-Z0-9_]+$/;

const SKIPPED_KEYS = new Set([
  'loc',
  'start',
  'end',
  'extra',
  'range',
  'leadingComments',
  'trailingComments',
  'innerComments',
]);

const WRAPPER_TYPES = new Set([
  'TSAsExpression',
  'TSSatisfiesExpression',
  'TSNonNullExpression',
  'TSTypeAssertion',
  'TypeCastExpression',
  'ParenthesizedExpression',
]);

function parserPlugins(filename: string): ParserPlugin[] {
  if (/\.[mc]?ts$/i.test(filename)) return ['typescript', 'decorators-legacy'];
  if (/\.tsx$/i.test(filename)) return ['typescript', 'jsx', 'decorators-legacy'];
  return ['jsx', 'flow', 'decorators-legacy'];
}

function isNode(value: unknown): value is AstNode {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    typeof value.type === 'string'
  );
}

/** Node elements of an AST array field; non-arrays and holes are dropped. */
function nodeList(value: unknown): AstNode[] {
  return Array.isArray(value) ? value.filter(isNode) : [];
}

/** `process.env` or `import.meta.env`, non-computed, member or optional member. */
function isEnvObject(node: unknown): node is AstNode {
  if (
    !isNode(node) ||
    (node.type !== 'MemberExpression' && node.type !== 'OptionalMemberExpression') ||
    node['computed']
  ) {
    return false;
  }
  const property = node['property'];
  if (!isNode(property) || property.type !== 'Identifier' || property['name'] !== 'env') {
    return false;
  }
  const object = node['object'];
  if (!isNode(object)) return false;
  if (object.type === 'Identifier') return object['name'] === 'process';
  const meta = object['meta'];
  const metaProperty = object['property'];
  return (
    object.type === 'MetaProperty' &&
    isNode(meta) &&
    meta['name'] === 'import' &&
    isNode(metaProperty) &&
    metaProperty['name'] === 'meta'
  );
}

/** Public key of `<env>.KEY`, `<env>['KEY']` or ``<env>[`KEY`]``, else undefined. */
function readKey(node: AstNode): string | undefined {
  if (
    (node.type !== 'MemberExpression' && node.type !== 'OptionalMemberExpression') ||
    !isEnvObject(node['object'])
  ) {
    return undefined;
  }
  const property = node['property'];
  if (!isNode(property)) return undefined;
  let key: unknown;
  if (!node['computed']) {
    key = property.type === 'Identifier' ? property['name'] : undefined;
  } else if (property.type === 'StringLiteral') {
    key = property['value'];
  } else if (
    property.type === 'TemplateLiteral' &&
    nodeList(property['expressions']).length === 0
  ) {
    const quasi = nodeList(property['quasis'])[0];
    const value = quasi?.['value'];
    key =
      typeof value === 'object' && value !== null && 'cooked' in value
        ? value.cooked
        : undefined;
  }
  return typeof key === 'string' && PUBLIC_KEY.test(key) ? key : undefined;
}

/** Collects the member expressions written to by a binding/assignment target. */
function collectWriteTargets(target: unknown, out: Set<AstNode>): void {
  if (!isNode(target)) return;
  switch (target.type) {
    case 'MemberExpression':
    case 'OptionalMemberExpression':
      out.add(target);
      return;
    case 'ObjectPattern':
      for (const property of nodeList(target['properties'])) {
        collectWriteTargets(
          property.type === 'RestElement' ? property['argument'] : property['value'],
          out
        );
      }
      return;
    case 'ArrayPattern':
      for (const element of nodeList(target['elements'])) {
        collectWriteTargets(element, out);
      }
      return;
    case 'AssignmentPattern':
      collectWriteTargets(target['left'], out);
      return;
    case 'RestElement':
      collectWriteTargets(target['argument'], out);
      return;
    case 'VariableDeclaration':
      for (const declarator of nodeList(target['declarations'])) {
        collectWriteTargets(declarator['id'], out);
      }
      return;
    default:
      if (WRAPPER_TYPES.has(target.type)) collectWriteTargets(target['expression'], out);
  }
}

/** Non-computed public keys bound by an object pattern, in source order. */
function destructuredPublicKeys(pattern: AstNode): string[] {
  const keys: string[] = [];
  for (const property of nodeList(pattern['properties'])) {
    if (property.type !== 'ObjectProperty' || property['computed']) continue;
    const key = property['key'];
    if (!isNode(key)) continue;
    const name =
      key.type === 'Identifier'
        ? key['name']
        : key.type === 'StringLiteral'
          ? key['value']
          : undefined;
    if (typeof name === 'string' && PUBLIC_KEY.test(name) && !keys.includes(name)) {
      keys.push(name);
    }
  }
  return keys;
}

/** JSON literal that is also safe as single-line JS source. */
function jsLiteral(value: string): string {
  return JSON.stringify(value)
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/**
 * Rewrites `process.env.ZE_PUBLIC_*` and `import.meta.env.ZE_PUBLIC_*` reads into
 * synchronous lookups of `globalThis.__ZEPHYR__.runtime.env[applicationUid]`, with the
 * build-time value as fallback. Writes are left untouched and no newlines are inserted,
 * so line numbers stay stable.
 *
 * Returns `null` when nothing was rewritten. Throws when the source cannot be parsed: an
 * un-rewritten read would silently yield `undefined` on device.
 */
export function rewriteEnvReadsToNativeLookup(
  source: string,
  options: NativeEnvRewriteOptions
): { code: string; map: SourceMap } | null {
  if (!source.includes('ZE_PUBLIC_')) return null;

  const { filename, applicationUid, buildEnv } = options;

  let program: AstNode;
  try {
    const file = parse(source, {
      sourceType: 'unambiguous',
      allowReturnOutsideFunction: true,
      allowUndeclaredExports: true,
      errorRecovery: false,
      plugins: parserPlugins(filename),
    });
    // Babel nodes are walked generically; only `type`, `start` and `end` are relied on.
    program = file.program as unknown as AstNode;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `[zephyr] Cannot rewrite ZE_PUBLIC_* reads in ${filename}: ${message}`
    );
  }

  const uidLiteral = jsLiteral(applicationUid);
  const lookup = (key: string): string => {
    const fallback = Object.prototype.hasOwnProperty.call(buildEnv, key)
      ? jsLiteral(buildEnv[key])
      : 'void 0';
    return `globalThis.__ZEPHYR__?.runtime?.env?.[${uidLiteral}]?.[${jsLiteral(key)}] ?? ${fallback}`;
  };

  const output = new MagicString(source);
  const writeTargets = new Set<AstNode>();
  const replaced = new Set<AstNode>();
  let changed = false;

  const destructure = (pattern: unknown, init: unknown): void => {
    if (!isNode(pattern) || pattern.type !== 'ObjectPattern' || !isEnvObject(init)) {
      return;
    }
    const keys = destructuredPublicKeys(pattern);
    if (keys.length === 0) return;
    const original = source.slice(init.start, init.end);
    const entries = keys.map((key) => `${jsLiteral(key)}: (${lookup(key)})`).join(', ');
    output.overwrite(init.start, init.end, `{ ...${original}, ${entries} }`);
    replaced.add(init);
    changed = true;
  };

  const stack: AstNode[] = [program];
  let node: AstNode | undefined;
  while ((node = stack.pop()) !== undefined) {
    if (replaced.has(node)) continue;

    switch (node.type) {
      case 'AssignmentExpression':
        collectWriteTargets(node['left'], writeTargets);
        if (node['operator'] === '=') destructure(node['left'], node['right']);
        break;
      case 'VariableDeclarator':
        destructure(node['id'], node['init']);
        break;
      case 'UpdateExpression':
        collectWriteTargets(node['argument'], writeTargets);
        break;
      case 'UnaryExpression':
        if (node['operator'] === 'delete') {
          collectWriteTargets(node['argument'], writeTargets);
        }
        break;
      case 'ForInStatement':
      case 'ForOfStatement':
        collectWriteTargets(node['left'], writeTargets);
        break;
      default: {
        if (writeTargets.has(node)) break;
        const key = readKey(node);
        if (key !== undefined) {
          output.overwrite(node.start, node.end, `(${lookup(key)})`);
          changed = true;
          continue;
        }
      }
    }

    for (const field of Object.keys(node)) {
      if (SKIPPED_KEYS.has(field)) continue;
      const value = node[field];
      if (Array.isArray(value)) {
        for (let index = value.length - 1; index >= 0; index--) {
          if (isNode(value[index])) stack.push(value[index]);
        }
      } else if (isNode(value)) {
        stack.push(value);
      }
    }
  }

  if (!changed) return null;

  return {
    code: output.toString(),
    map: output.generateMap({ source: filename, includeContent: true, hires: true }),
  };
}
