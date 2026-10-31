import fs from 'fs';
import type { BundlerConfig, BundlerOperationId, OperationResult } from './types.js';
import { hasRstackZephyr, transformRstackSection } from './rstack.js';
import {
  applyEdits,
  hasTrailingComma,
  isCallTo,
  isFunction,
  isIdentifier,
  isKeyValueProperty,
  isModuleExportsAssignment,
  parseFile,
  propertyKeyName,
  sliceList,
  type AstNode,
  type ParsedSource,
  type TextEdit,
} from './engine/ast.js';

export interface OperationContext {
  filePath: string;
  config: BundlerConfig;
  dryRun: boolean;
}

/**
 * Produces the edits for one rewrite attempt; an empty list means the attempt did not
 * match.
 */
type RewriteAttempt = (parsed: ParsedSource) => TextEdit[];

const ZEPHYR_CALL = 'withZephyr()';

function runRewriteSequence(
  context: OperationContext,
  attempts: RewriteAttempt[]
): OperationResult {
  try {
    const parsed = parseFile(context.filePath);
    for (const attempt of attempts) {
      const edits = attempt(parsed);
      if (edits.length === 0) continue;
      if (!context.dryRun) {
        const nextSource = applyEdits(parsed.source, edits);
        if (nextSource !== parsed.source) fs.writeFileSync(context.filePath, nextSource);
      }
      return { status: 'changed' };
    }
    return { status: 'no-match' };
  } catch (error) {
    return { status: 'error', error: (error as Error).message };
  }
}

function replaceNode(node: AstNode, text: string): TextEdit {
  return { start: node.start, end: node.end, text };
}

/** List text with `item` appended, dropping any trailing comma. */
function appendToList(
  parsed: ParsedSource,
  items: (AstNode | null)[],
  item: string
): string {
  const existing = sliceList(parsed, items);
  return existing ? `${existing}, ${item}` : item;
}

/** Object literal text with `property` added as the last entry. */
function objectWithProperty(
  parsed: ParsedSource,
  object: AstNode,
  property: string
): string {
  const existing = sliceList(parsed, object.properties);
  return existing ? `{\n  ${existing},\n  ${property}\n}` : `{\n  ${property}\n}`;
}

/** `name: [...]` / `name: {...}` properties anywhere in the file, in document order. */
function propertiesWithValue(
  parsed: ParsedSource,
  name: string,
  valueType: 'ArrayExpression' | 'ObjectExpression'
): AstNode[] {
  return parsed
    .ofType('Property')
    .filter((node) => isKeyValueProperty(node, name) && node.value?.type === valueType);
}

/** Object literals passed as the only argument of `callee(...)`. */
function soleObjectArguments(parsed: ParsedSource, callee: string): AstNode[] {
  return parsed
    .ofType('CallExpression')
    .filter(
      (call) =>
        isCallTo(call, callee) &&
        call.arguments.length === 1 &&
        call.arguments[0].type === 'ObjectExpression'
    )
    .map((call) => call.arguments[0]);
}

function exportDefaultDeclarations(parsed: ParsedSource): AstNode[] {
  return parsed
    .ofType('ExportDefaultDeclaration')
    .map((node) => node.declaration)
    .filter(Boolean);
}

function exportDefaultObjects(parsed: ParsedSource): AstNode[] {
  return exportDefaultDeclarations(parsed).filter(
    (declaration) => declaration.type === 'ObjectExpression'
  );
}

/**
 * Add `key: value` to each object. Objects that already define `key` are skipped: a
 * duplicate key would silently override the user's value.
 */
function addPropertyTo(
  objects: (parsed: ParsedSource) => AstNode[],
  key: string,
  value: string
) {
  return (parsed: ParsedSource) =>
    objects(parsed)
      .filter(
        (object) =>
          !(object.properties as AstNode[]).some(
            (property) =>
              property.type === 'Property' && propertyKeyName(property) === key
          )
      )
      .map((object) =>
        replaceNode(object, objectWithProperty(parsed, object, `${key}: ${value}`))
      );
}

function appendArrayPropertyEdit(
  parsed: ParsedSource,
  property: AstNode,
  propertyName: string,
  item: string
): TextEdit {
  return replaceNode(
    property,
    `${propertyName}: [${appendToList(parsed, property.value.elements, item)}]`
  );
}

/**
 * Append withZephyr() to `propertyName: [...]` arrays. Arrays are grouped by shape
 * (empty, one item, several items, with or without a trailing comma, keyed off the first
 * array in the file) and only the first non-empty group is rewritten, matching the
 * ast-grep rewrite sequence this replaced.
 */
function appendToArrayProperty(
  context: OperationContext,
  propertyName: string
): OperationResult {
  return runRewriteSequence(context, [
    (parsed) => {
      const properties = propertiesWithValue(parsed, propertyName, 'ArrayExpression');
      if (properties.length === 0) return [];
      const trailing = (property: AstNode) =>
        hasTrailingComma(parsed, property.value, property.value.elements);
      const size = (property: AstNode) => property.value.elements.length;
      const groups: ((property: AstNode) => boolean)[] = trailing(properties[0])
        ? [
            (property) => trailing(property) && size(property) === 1,
            (property) => trailing(property) && size(property) >= 2,
          ]
        : [
            (property) => size(property) === 0,
            (property) => size(property) === 1,
            (property) => size(property) >= 2,
          ];
      for (const group of groups) {
        const selected = properties.filter(group);
        if (selected.length > 0) {
          return selected.map((property) =>
            appendArrayPropertyEdit(parsed, property, propertyName, ZEPHYR_CALL)
          );
        }
      }
      return [];
    },
  ]);
}

function createArrayPropertyInDefineConfig(
  context: OperationContext,
  propertyName: string
): OperationResult {
  const value = `[${ZEPHYR_CALL}]`;
  return runRewriteSequence(context, [
    addPropertyTo(
      (parsed) => soleObjectArguments(parsed, 'defineConfig'),
      propertyName,
      value
    ),
    addPropertyTo(exportDefaultObjects, propertyName, value),
  ]);
}

function createArrayPropertyInDefineConfigFunction(
  context: OperationContext,
  propertyName: string
): OperationResult {
  // `defineConfig((env) => ({ ... }))`: the returned object literal.
  const returnedObjects = (parsed: ParsedSource) =>
    parsed
      .ofType('CallExpression')
      .filter((call) => isCallTo(call, 'defineConfig') && call.arguments.length === 1)
      .map((call) => call.arguments[0])
      .filter(
        (callback) =>
          callback.type === 'ArrowFunctionExpression' &&
          callback.body.type === 'ParenthesizedExpression' &&
          callback.body.expression.type === 'ObjectExpression'
      )
      .map((callback) => callback.body.expression);
  return runRewriteSequence(context, [
    addPropertyTo(returnedObjects, propertyName, `[${ZEPHYR_CALL}]`),
  ]);
}

function handleComposePlugins(context: OperationContext): OperationResult {
  return runRewriteSequence(context, [
    (parsed) =>
      parsed
        .ofType('CallExpression')
        .filter((call) => isCallTo(call, 'composePlugins'))
        .map((call) => {
          const args: AstNode[] = call.arguments;
          const terminal = isFunction(args.at(-1)) ? args.at(-1)! : undefined;
          const plugins = terminal ? args.slice(0, -1) : args;
          const parts = [sliceList(parsed, plugins), ZEPHYR_CALL, parsed.text(terminal)];
          return replaceNode(
            call,
            `${parsed.text(call.callee)}(${parts.filter(Boolean).join(', ')})`
          );
        }),
  ]);
}

/** Wrap every `module.exports = value` right-hand side. */
function wrapModuleExports(wrap: (value: string) => string): RewriteAttempt {
  return (parsed) =>
    parsed
      .ofType('AssignmentExpression')
      .filter(isModuleExportsAssignment)
      .map((assignment) =>
        replaceNode(assignment.right, wrap(parsed.text(assignment.right)))
      );
}

/** Wrap every `export default` value accepted by `filter`. */
function wrapExportDefault(
  wrap: (value: string) => string,
  filter: (declaration: AstNode) => boolean = () => true
): RewriteAttempt {
  return (parsed) =>
    exportDefaultDeclarations(parsed)
      .filter(filter)
      .map((declaration) => replaceNode(declaration, wrap(parsed.text(declaration))));
}

const wrapWithZephyr = (value: string) => `${ZEPHYR_CALL}(${value})`;
const wrapWithZephyrAsync = (value: string) =>
  `(async () => { const __zephyrConfig = await ${value}; return ${ZEPHYR_CALL}(typeof __zephyrConfig === "function" ? await __zephyrConfig() : __zephyrConfig); })()`;

function handleWrapModuleExports(context: OperationContext): OperationResult {
  return runRewriteSequence(context, [wrapModuleExports(wrapWithZephyr)]);
}

function handleWrapModuleExportsAsync(context: OperationContext): OperationResult {
  return runRewriteSequence(context, [wrapModuleExports(wrapWithZephyrAsync)]);
}

function handleWrapExportDefaultAsync(context: OperationContext): OperationResult {
  return runRewriteSequence(context, [wrapExportDefault(wrapWithZephyrAsync)]);
}

function handleWrapExportDefaultDefineConfig(context: OperationContext): OperationResult {
  return runRewriteSequence(context, [
    wrapExportDefault(wrapWithZephyr, (declaration) =>
      isCallTo(declaration, 'defineConfig')
    ),
  ]);
}

function handleWrapExportDefaultObject(context: OperationContext): OperationResult {
  return runRewriteSequence(context, [
    wrapExportDefault(
      wrapWithZephyr,
      (declaration) => declaration.type === 'ObjectExpression'
    ),
  ]);
}

function lineIndent(source: string, offset: number): string {
  const lineStart = source.lastIndexOf('\n', offset - 1) + 1;
  const indent = source.slice(lineStart, offset);
  return /^\s*$/.test(indent) ? indent : '';
}

/**
 * `module.exports = (config) => { ...; return config; }`: push withZephyr() into
 * `config.plugins`.
 */
function handleRollupFunction(context: OperationContext): OperationResult {
  return runRewriteSequence(context, [
    (parsed) =>
      parsed
        .ofType('AssignmentExpression')
        .filter(isModuleExportsAssignment)
        .map((assignment) => assignment.right)
        .filter(
          (callback) =>
            (callback.type === 'ArrowFunctionExpression' ||
              callback.type === 'FunctionExpression') &&
            callback.params.length === 1 &&
            isIdentifier(callback.params[0]) &&
            callback.body.type === 'BlockStatement'
        )
        .map((callback) => {
          const push = `${callback.params[0].name}.plugins.push(${ZEPHYR_CALL});`;
          const statements: AstNode[] = callback.body.body;
          const returned = statements.find(
            (statement) => statement.type === 'ReturnStatement' && statement.argument
          );
          if (returned) {
            const indent = lineIndent(parsed.source, returned.start);
            const separator = indent ? `\n${indent}` : ' ';
            return {
              start: returned.start,
              end: returned.start,
              text: `${push}${separator}`,
            };
          }
          const last = statements.at(-1);
          if (last) {
            const indent = lineIndent(parsed.source, last.start);
            return {
              start: last.end,
              end: last.end,
              text: indent ? `\n${indent}${push}` : ` ${push}`,
            };
          }
          const open = callback.body.start + 1;
          return { start: open, end: open, text: ` ${push} ` };
        }),
  ]);
}

function handleRollupArray(context: OperationContext): OperationResult {
  // `export default [{ ..., plugins: [...] }, ...]`: only the first build entry.
  const specific = runRewriteSequence(context, [
    (parsed) =>
      exportDefaultDeclarations(parsed)
        .filter(
          (declaration) =>
            declaration.type === 'ArrayExpression' &&
            declaration.elements[0]?.type === 'ObjectExpression'
        )
        .flatMap((declaration) =>
          declaration.elements[0].properties.filter(
            (property: AstNode) =>
              isKeyValueProperty(property, 'plugins') &&
              property.value.type === 'ArrayExpression'
          )
        )
        .map((property) =>
          appendArrayPropertyEdit(parsed, property, 'plugins', ZEPHYR_CALL)
        ),
  ]);

  if (specific.status !== 'no-match') {
    return specific;
  }

  return appendToArrayProperty(context, 'plugins');
}

function handlePluginsArrayOrCreate(context: OperationContext): OperationResult {
  const appendResult = appendToArrayProperty(context, 'plugins');
  if (appendResult.status !== 'no-match') {
    return appendResult;
  }

  return createArrayPropertyInDefineConfig(context, 'plugins');
}

function handleNuxtModulesOrCreate(context: OperationContext): OperationResult {
  const moduleItem = `"${context.config.plugin}"`;
  const appendResult = runRewriteSequence(context, [
    (parsed) =>
      propertiesWithValue(parsed, 'modules', 'ArrayExpression').map((property) =>
        appendArrayPropertyEdit(parsed, property, 'modules', moduleItem)
      ),
  ]);

  if (appendResult.status !== 'no-match') {
    return appendResult;
  }

  const modules = `[${moduleItem}]`;
  return runRewriteSequence(context, [
    addPropertyTo(
      (parsed) => soleObjectArguments(parsed, 'defineNuxtConfig'),
      'modules',
      modules
    ),
    addPropertyTo(exportDefaultObjects, 'modules', modules),
  ]);
}

function handleAstroIntegrationsOrCreate(context: OperationContext): OperationResult {
  const appendResult = appendToArrayProperty(context, 'integrations');
  if (appendResult.status !== 'no-match') {
    return appendResult;
  }

  return createArrayPropertyInDefineConfig(context, 'integrations');
}

function handleAstroIntegrationsFunctionOrCreate(
  context: OperationContext
): OperationResult {
  const content = fs.readFileSync(context.filePath, 'utf8');
  const hasDefineConfigArrow =
    /defineConfig\s*\(\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/.test(content);
  if (!hasDefineConfigArrow) {
    return { status: 'no-match' };
  }

  const appendResult = appendToArrayProperty(context, 'integrations');
  if (appendResult.status !== 'no-match') {
    return appendResult;
  }

  return createArrayPropertyInDefineConfigFunction(context, 'integrations');
}

function handleRsbuildAssetPrefix(context: OperationContext): OperationResult {
  const content = fs.readFileSync(context.filePath, 'utf8');
  if (/assetPrefix\s*:/.test(content)) {
    return { status: 'no-match' };
  }

  const assetPrefix = 'assetPrefix: "auto"';
  const addToExistingOutput = runRewriteSequence(context, [
    (parsed) =>
      propertiesWithValue(parsed, 'output', 'ObjectExpression').map((property) =>
        replaceNode(
          property,
          `output: ${objectWithProperty(parsed, property.value, assetPrefix)}`
        )
      ),
  ]);

  if (addToExistingOutput.status !== 'no-match') {
    return addToExistingOutput;
  }

  const output = `{ ${assetPrefix} }`;
  return runRewriteSequence(context, [
    addPropertyTo(
      (parsed) => soleObjectArguments(parsed, 'defineConfig'),
      'output',
      output
    ),
    addPropertyTo(exportDefaultObjects, 'output', output),
  ]);
}

function handleWrapExportedFunction(context: OperationContext): OperationResult {
  const content = fs.readFileSync(context.filePath, 'utf8');
  const match = content.match(/export\s+default\s+([A-Za-z_$][\w$]*)\s*;?/);
  if (!match || !match[1]) {
    return { status: 'no-match' };
  }

  const configName = match[1];
  const functionPattern = new RegExp(
    `(?:const|let|var)\\s+${configName}\\s*=\\s*(?:async\\s*)?(?:\\([^)]*\\)|[A-Za-z_$][\\w$]*)\\s*=>|` +
      `(?:const|let|var)\\s+${configName}\\s*=\\s*function\\b|` +
      `function\\s+${configName}\\s*\\(`,
    'm'
  );

  if (!functionPattern.test(content)) {
    return { status: 'no-match' };
  }

  const replaced = content.replace(
    /export\s+default\s+([A-Za-z_$][\w$]*)\s*;?/,
    'export default withZephyr()($1);'
  );

  if (replaced === content) {
    return { status: 'no-match' };
  }

  if (!context.dryRun) {
    fs.writeFileSync(context.filePath, replaced);
  }

  return { status: 'changed' };
}

function handleParcelReporters(context: OperationContext): OperationResult {
  try {
    const content = fs.readFileSync(context.filePath, 'utf8');
    const config = JSON.parse(content) as { reporters?: string[] };
    const reporters = Array.isArray(config.reporters) ? config.reporters : [];

    if (reporters.includes(context.config.plugin)) {
      return { status: 'no-match' };
    }

    config.reporters = [...reporters, context.config.plugin];

    if (!context.dryRun) {
      fs.writeFileSync(context.filePath, JSON.stringify(config, null, 2));
    }

    return { status: 'changed' };
  } catch (error) {
    return {
      status: 'error',
      error: (error as Error).message,
    };
  }
}

const OPERATION_HANDLERS: Record<
  BundlerOperationId,
  (context: OperationContext) => OperationResult
> = {
  'compose-plugins': handleComposePlugins,
  'plugins-array': (context) => appendToArrayProperty(context, 'plugins'),
  'plugins-array-or-create': handlePluginsArrayOrCreate,
  'nuxt-modules-or-create': handleNuxtModulesOrCreate,
  'wrap-module-exports': handleWrapModuleExports,
  'wrap-module-exports-async': handleWrapModuleExportsAsync,
  'wrap-export-default-async': handleWrapExportDefaultAsync,
  'wrap-export-default-define-config': handleWrapExportDefaultDefineConfig,
  'wrap-export-default-object': handleWrapExportDefaultObject,
  'rollup-function': handleRollupFunction,
  'rollup-array': handleRollupArray,
  'astro-integrations-or-create': handleAstroIntegrationsOrCreate,
  'astro-integrations-function-or-create': handleAstroIntegrationsFunctionOrCreate,
  'rsbuild-asset-prefix': handleRsbuildAssetPrefix,
  'wrap-exported-function': handleWrapExportedFunction,
  'parcel-reporters': handleParcelReporters,
  'rstack-plugins': (context) =>
    transformRstackSection(context.filePath, context.config, context.dryRun),
};

export function runBundlerOperation(
  operationId: BundlerOperationId,
  context: OperationContext
): OperationResult {
  const handler = OPERATION_HANDLERS[operationId];
  return handler(context);
}

export function applyBundlerOperations(context: OperationContext): OperationResult {
  const { strategy, operations } = context.config;
  let hasChanged = false;

  for (const operationId of operations) {
    const result = runBundlerOperation(operationId, context);
    if (result.status === 'error') {
      return result;
    }

    if (result.status === 'changed') {
      hasChanged = true;
      if (strategy === 'first-success') {
        return { status: 'changed' };
      }
    }
  }

  if (hasChanged) {
    return { status: 'changed' };
  }

  return { status: 'no-match' };
}

export function hasZephyrCall(
  filePath: string,
  config?: Pick<BundlerConfig, 'plugin' | 'rstackSection'>
): OperationResult {
  if (config?.rstackSection) {
    return {
      status: hasRstackZephyr(filePath, config) ? 'changed' : 'no-match',
    };
  }
  if (config?.plugin === 'zephyr-nuxt-module') {
    const content = fs.readFileSync(filePath, 'utf8');
    if (/['"]zephyr-nuxt-module['"]/.test(content)) {
      return { status: 'changed' };
    }
  }

  try {
    const parsed = parseFile(filePath);
    const found = parsed
      .ofType('CallExpression')
      .some((call) => isCallTo(call, 'withZephyr') && call.arguments.length === 0);
    return { status: found ? 'changed' : 'no-match' };
  } catch (error) {
    return {
      status: 'error',
      error: (error as Error).message || 'Failed to analyze file',
    };
  }
}
