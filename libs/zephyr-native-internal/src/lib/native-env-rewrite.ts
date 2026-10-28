import { parse, type ParserPlugin } from '@babel/parser';
import MagicString, { type SourceMap } from 'magic-string';
import { createRequire } from 'node:module';

export interface NativeEnvLookupOptions {
  /** Zephyr application UID that scopes runtime overrides. */
  applicationUid: string;
  /** Build-time `ZE_PUBLIC_*` values compiled in as fallbacks. */
  buildEnv: Readonly<Record<string, string>>;
}

export interface NativeEnvRewriteOptions extends NativeEnvLookupOptions {
  /** Source file path; selects parser plugins and names the source map source. */
  filename: string;
}

/** Babel AST node; parsed nodes always carry source offsets. */
interface AstNode {
  type: string;
  start: number;
  end: number;
  [key: string]: unknown;
}

/** Keys whose reads are rewritten. */
const REWRITTEN_KEY = /^ZE_PUBLIC_[A-Z0-9_]+$/;
const LINE_BREAK = /\r\n|[\n\r\u2028\u2029]/g;

const requireFromHere = createRequire(__filename);

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

/** Rewritten key of `<env>.KEY`, `<env>['KEY']` or ``<env>[`KEY`]``, else undefined. */
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
  return typeof key === 'string' && REWRITTEN_KEY.test(key) ? key : undefined;
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

/**
 * Non-computed rewritten keys bound by an object pattern, in source order, and whether
 * the pattern binds nothing else (no other keys, computed keys or rest element).
 */
function destructuredKeys(pattern: AstNode): { keys: string[]; onlyRewritten: boolean } {
  const keys: string[] = [];
  let onlyRewritten = true;
  for (const property of nodeList(pattern['properties'])) {
    const key = property['key'];
    const name =
      property.type !== 'ObjectProperty' || property['computed'] || !isNode(key)
        ? undefined
        : key.type === 'Identifier'
          ? key['name']
          : key.type === 'StringLiteral'
            ? key['value']
            : undefined;
    if (typeof name !== 'string' || !REWRITTEN_KEY.test(name)) {
      onlyRewritten = false;
    } else if (!keys.includes(name)) {
      keys.push(name);
    }
  }
  return { keys, onlyRewritten };
}

/** JSON literal that is also safe as single-line JS source. */
function jsLiteral(value: string): string {
  return JSON.stringify(value)
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/** Whether `source` may contain env reads the native rewrite replaces; a cheap prefilter. */
export function hasNativeEnvReads(source: string): boolean {
  return source.includes('ZE_PUBLIC_');
}

/**
 * Plans the native env rewrite of a parsed Babel-compatible program. Maps each
 * `process.env` / `import.meta.env` read of a `ZE_PUBLIC_*` key to a synchronous lookup
 * of `globalThis.__ZEPHYR__.runtime.env[applicationUid]` with the build-time value as
 * fallback. A destructured env object maps to an object literal providing those keys.
 * Writes are never planned.
 *
 * Keys are the AST nodes to replace; values are JS expression sources.
 */
export function planNativeEnvRewrites(
  program: object,
  options: NativeEnvLookupOptions
): ReadonlyMap<object, string> {
  const { applicationUid, buildEnv } = options;
  const uidLiteral = jsLiteral(applicationUid);
  const lookup = (key: string): string => {
    const fallback = Object.prototype.hasOwnProperty.call(buildEnv, key)
      ? jsLiteral(buildEnv[key])
      : 'void 0';
    return `globalThis.__ZEPHYR__?.runtime?.env?.[${uidLiteral}]?.[${jsLiteral(key)}] ?? ${fallback}`;
  };

  const rewrites = new Map<AstNode, string>();
  const writeTargets = new Set<AstNode>();

  const destructure = (pattern: unknown, init: unknown): void => {
    if (!isNode(pattern) || pattern.type !== 'ObjectPattern' || !isEnvObject(init)) {
      return;
    }
    const { keys, onlyRewritten } = destructuredKeys(pattern);
    if (keys.length === 0) return;
    const entries = keys.map((key) => `${jsLiteral(key)}: (${lookup(key)})`);
    const object = init['object'];
    const isProcessEnv = isNode(object) && object.type === 'Identifier';
    // `import.meta` is not valid in React Native script bundles, so it is only kept
    // when the pattern also reads keys this rewrite cannot provide.
    if (isProcessEnv || !onlyRewritten) {
      entries.unshift(
        isProcessEnv
          ? `...process${init['optional'] ? '?.' : '.'}env`
          : '...import.meta.env'
      );
    }
    rewrites.set(init, `{ ${entries.join(', ')} }`);
  };

  const stack: AstNode[] = [program as AstNode];
  let node: AstNode | undefined;
  while ((node = stack.pop()) !== undefined) {
    if (rewrites.has(node)) continue;

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
          rewrites.set(node, lookup(key));
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

  return rewrites;
}

/**
 * Parses with Babel; JS files Babel rejects are retried with hermes-parser, which accepts
 * the Flow component and hook syntax React Native's Babel preset parses. Its Babel-mode
 * AST keeps the source offsets the rewrite relies on.
 */
function parseProgram(source: string, filename: string): AstNode {
  try {
    const file = parse(source, {
      sourceType: 'unambiguous',
      allowReturnOutsideFunction: true,
      allowUndeclaredExports: true,
      errorRecovery: false,
      plugins: parserPlugins(filename),
    });
    // Babel nodes are walked generically; only `type`, `start` and `end` are relied on.
    return file.program as unknown as AstNode;
  } catch (error) {
    if (!/\.(?:[mc]?ts|tsx)$/i.test(filename)) {
      try {
        // Loaded lazily: only Flow sources Babel cannot parse need it.
        const hermes = requireFromHere('hermes-parser') as {
          parse(source: string, options: Record<string, unknown>): { program: unknown };
        };
        return hermes.parse(source, {
          babel: true,
          flow: 'all',
          sourceType: 'unambiguous',
          allowReturnOutsideFunction: true,
        }).program as AstNode;
      } catch {
        // Report Babel's error: it describes the source as the user wrote it.
      }
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `[zephyr] Cannot rewrite ZE_PUBLIC_* reads in ${filename}: ${message}`
    );
  }
}

/**
 * Applies {@link planNativeEnvRewrites} to source text. Replacements keep the line breaks
 * of the code they replace, so line numbers stay stable for transformers that receive no
 * input source map; columns after a replacement on the same line shift.
 *
 * Returns `null` when nothing was rewritten. Throws when the source cannot be parsed: an
 * un-rewritten read would silently yield `undefined` on device.
 */
export function rewriteEnvReadsToNativeLookup(
  source: string,
  options: NativeEnvRewriteOptions
): { code: string; map: SourceMap } | null {
  if (!hasNativeEnvReads(source)) return null;

  const program = parseProgram(source, options.filename);
  const rewrites = planNativeEnvRewrites(program, options);
  if (rewrites.size === 0) return null;

  const output = new MagicString(source);
  for (const [node, code] of rewrites) {
    const { start, end } = node as AstNode;
    const lineBreaks = source.slice(start, end).match(LINE_BREAK)?.join('') ?? '';
    // Inside the parentheses, the kept line breaks cannot trigger semicolon insertion.
    output.overwrite(start, end, `(${code}${lineBreaks})`);
  }

  return {
    code: output.toString(),
    map: output.generateMap({
      source: options.filename,
      includeContent: true,
      hires: true,
    }),
  };
}
