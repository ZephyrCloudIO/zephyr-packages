import fs from 'fs';
import type { BundlerConfig, BundlerOperationId, OperationResult } from './types.js';
import {
  rewriteWithAstGrep,
  searchWithAstGrep,
  type AstGrepLanguage,
} from './engine/ast-grep.js';

export interface OperationContext {
  filePath: string;
  config: BundlerConfig;
  dryRun: boolean;
}

interface RewriteAttempt {
  pattern: string;
  rewrite: string;
  selector?: string;
  language?: AstGrepLanguage;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function tryRewrite(context: OperationContext, attempt: RewriteAttempt): OperationResult {
  const result = rewriteWithAstGrep({
    filePath: context.filePath,
    pattern: attempt.pattern,
    rewrite: attempt.rewrite,
    selector: attempt.selector,
    language: attempt.language,
    updateAll: !context.dryRun,
  });

  if (result.status === 'match') {
    return { status: 'changed' };
  }

  if (result.status === 'no-match') {
    return { status: 'no-match' };
  }

  return {
    status: 'error',
    error: result.stderr || 'ast-grep rewrite failed',
  };
}

function runRewriteSequence(
  context: OperationContext,
  attempts: RewriteAttempt[]
): OperationResult {
  for (const attempt of attempts) {
    const result = tryRewrite(context, attempt);
    if (result.status !== 'no-match') {
      return result;
    }
  }

  return { status: 'no-match' };
}

function findMatchingArrayBracket(source: string, openBracketIndex: number): number {
  let depth = 0;
  let inString: "'" | '"' | '`' | null = null;
  let inLineComment = false;
  let inBlockComment = false;
  let isEscaped = false;

  for (let index = openBracketIndex; index < source.length; index += 1) {
    const char = source[index];
    const nextChar = source[index + 1];

    if (inLineComment) {
      if (char === '\n') {
        inLineComment = false;
      }
      continue;
    }

    if (inBlockComment) {
      if (char === '*' && nextChar === '/') {
        inBlockComment = false;
        index += 1;
      }
      continue;
    }

    if (inString) {
      if (isEscaped) {
        isEscaped = false;
        continue;
      }

      if (char === '\\') {
        isEscaped = true;
        continue;
      }

      if (char === inString) {
        inString = null;
      }
      continue;
    }

    if (char === '/' && nextChar === '/') {
      inLineComment = true;
      index += 1;
      continue;
    }

    if (char === '/' && nextChar === '*') {
      inBlockComment = true;
      index += 1;
      continue;
    }

    if (char === "'" || char === '"' || char === '`') {
      inString = char;
      continue;
    }

    if (char === '[') {
      depth += 1;
      continue;
    }

    if (char === ']') {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

function appendToNamedArrayProperty(
  source: string,
  propertyName: string,
  appendedValue: string
): string | null {
  const propertyPattern = new RegExp(
    `\\b${escapeRegExp(propertyName)}\\b\\s*:\\s*\\[`,
    'g'
  );

  for (const match of source.matchAll(propertyPattern)) {
    if (match.index === undefined) {
      continue;
    }

    const openBracketIndex = match.index + match[0].lastIndexOf('[');
    const closeBracketIndex = findMatchingArrayBracket(source, openBracketIndex);
    if (closeBracketIndex === -1) {
      continue;
    }

    const arrayContent = source.slice(openBracketIndex + 1, closeBracketIndex);
    const trimmedEnd = arrayContent.trimEnd();
    const trailingWhitespace = arrayContent.slice(trimmedEnd.length);

    let nextArrayContent: string;
    if (trimmedEnd.length === 0) {
      nextArrayContent = `${appendedValue}${trailingWhitespace}`;
    } else if (trimmedEnd.endsWith(',')) {
      nextArrayContent = `${trimmedEnd} ${appendedValue}${trailingWhitespace}`;
    } else {
      nextArrayContent = `${trimmedEnd}, ${appendedValue}${trailingWhitespace}`;
    }

    return (
      source.slice(0, openBracketIndex + 1) +
      nextArrayContent +
      source.slice(closeBracketIndex)
    );
  }

  return null;
}

function appendToArrayProperty(
  context: OperationContext,
  propertyName: string
): OperationResult {
  try {
    const content = fs.readFileSync(context.filePath, 'utf8');
    const nextContent = appendToNamedArrayProperty(content, propertyName, 'withZephyr()');

    if (!nextContent || nextContent === content) {
      return { status: 'no-match' };
    }

    if (!context.dryRun) {
      fs.writeFileSync(context.filePath, nextContent);
    }

    return { status: 'changed' };
  } catch (error) {
    return {
      status: 'error',
      error: (error as Error).message,
    };
  }
}

function createArrayPropertyInDefineConfig(
  context: OperationContext,
  propertyName: string
): OperationResult {
  return runRewriteSequence(context, [
    {
      pattern: 'defineConfig({$$$PROPS})',
      selector: 'object',
      rewrite: `{
  $$$PROPS,
  ${propertyName}: [withZephyr()]
}`,
    },
    {
      pattern: 'export default {$$$PROPS}',
      selector: 'object',
      rewrite: `{
  $$$PROPS,
  ${propertyName}: [withZephyr()]
}`,
    },
  ]);
}

function createArrayPropertyInDefineConfigFunction(
  context: OperationContext,
  propertyName: string
): OperationResult {
  return runRewriteSequence(context, [
    {
      pattern: `defineConfig(($$$ARGS) => ({ ${propertyName}: [$$$ITEMS], $$$REST }))`,
      rewrite: `defineConfig(($$$ARGS) => ({ ${propertyName}: [$$$ITEMS, withZephyr()], $$$REST }))`,
    },
    {
      pattern: `defineConfig(($$$ARGS) => ({ ${propertyName}: [$$$ITEMS] }))`,
      rewrite: `defineConfig(($$$ARGS) => ({ ${propertyName}: [$$$ITEMS, withZephyr()] }))`,
    },
    {
      pattern: 'defineConfig(($$$ARGS) => ({$$$PROPS}))',
      selector: 'object',
      rewrite: `{
  $$$PROPS,
  ${propertyName}: [withZephyr()]
}`,
    },
  ]);
}

function handleComposePlugins(context: OperationContext): OperationResult {
  return runRewriteSequence(context, [
    {
      pattern: 'composePlugins($$$PLUGINS, ($$$ARGS) => $BODY)',
      rewrite: 'composePlugins($$$PLUGINS, withZephyr(), ($$$ARGS) => $BODY)',
    },
    {
      pattern: 'composePlugins($$$PLUGINS, function($$$ARGS) { $$$BODY })',
      rewrite: 'composePlugins($$$PLUGINS, withZephyr(), function($$$ARGS) { $$$BODY })',
    },
    {
      pattern: 'composePlugins($$$PLUGINS)',
      rewrite: 'composePlugins($$$PLUGINS, withZephyr())',
    },
  ]);
}

function handleWrapModuleExports(context: OperationContext): OperationResult {
  return runRewriteSequence(context, [
    {
      pattern: 'module.exports = $VALUE',
      rewrite: 'module.exports = withZephyr()($VALUE)',
    },
  ]);
}

function handleWrapModuleExportsAsync(context: OperationContext): OperationResult {
  return runRewriteSequence(context, [
    {
      pattern: 'module.exports = $VALUE',
      rewrite:
        'module.exports = (async () => { const __zephyrConfig = await $VALUE; return withZephyr()(typeof __zephyrConfig === "function" ? await __zephyrConfig() : __zephyrConfig); })()',
    },
  ]);
}

function handleWrapExportDefaultAsync(context: OperationContext): OperationResult {
  return runRewriteSequence(context, [
    {
      pattern: 'export default $VALUE',
      rewrite:
        'export default (async () => { const __zephyrConfig = await $VALUE; return withZephyr()(typeof __zephyrConfig === "function" ? await __zephyrConfig() : __zephyrConfig); })()',
    },
  ]);
}

function handleWrapExportDefaultDefineConfig(context: OperationContext): OperationResult {
  return runRewriteSequence(context, [
    {
      pattern: 'export default defineConfig($$$ARGS)',
      rewrite: 'export default withZephyr()(defineConfig($$$ARGS))',
    },
  ]);
}

function handleWrapExportDefaultObject(context: OperationContext): OperationResult {
  return runRewriteSequence(context, [
    {
      pattern: 'export default {$$$PROPS}',
      rewrite: 'export default withZephyr()({$$$PROPS})',
    },
  ]);
}

function handleRollupFunction(context: OperationContext): OperationResult {
  return runRewriteSequence(context, [
    {
      pattern: 'module.exports = ($PARAM) => { $$$BEFORE return $RET; $$$AFTER }',
      rewrite:
        'module.exports = ($PARAM) => { $$$BEFORE $PARAM.plugins.push(withZephyr()); return $RET; $$$AFTER }',
    },
    {
      pattern: 'module.exports = function($PARAM) { $$$BEFORE return $RET; $$$AFTER }',
      rewrite:
        'module.exports = function($PARAM) { $$$BEFORE $PARAM.plugins.push(withZephyr()); return $RET; $$$AFTER }',
    },
    {
      pattern: 'module.exports = ($PARAM) => { $$$BODY }',
      rewrite:
        'module.exports = ($PARAM) => { $$$BODY $PARAM.plugins.push(withZephyr()); }',
    },
    {
      pattern: 'module.exports = function($PARAM) { $$$BODY }',
      rewrite:
        'module.exports = function($PARAM) { $$$BODY $PARAM.plugins.push(withZephyr()); }',
    },
  ]);
}

function handleRollupArray(context: OperationContext): OperationResult {
  const specific = runRewriteSequence(context, [
    {
      pattern: 'export default [{ $$$A, plugins: [$$$ITEMS], $$$B }, $$$REST]',
      rewrite:
        'export default [{ $$$A, plugins: [$$$ITEMS, withZephyr()], $$$B }, $$$REST]',
    },
    {
      pattern: 'export default [{ plugins: [$$$ITEMS], $$$B }, $$$REST]',
      rewrite: 'export default [{ plugins: [$$$ITEMS, withZephyr()], $$$B }, $$$REST]',
    },
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

  const addToExistingOutput = runRewriteSequence(context, [
    {
      pattern: '{ output: {$$$OUTPUT_PROPS} }',
      selector: 'pair',
      rewrite: `output: {
  $$$OUTPUT_PROPS,
  assetPrefix: "auto"
}`,
    },
  ]);

  if (addToExistingOutput.status !== 'no-match') {
    return addToExistingOutput;
  }

  return runRewriteSequence(context, [
    {
      pattern: 'defineConfig({$$$PROPS})',
      selector: 'object',
      rewrite: `{
  $$$PROPS,
  output: { assetPrefix: "auto" }
}`,
    },
    {
      pattern: 'export default {$$$PROPS}',
      selector: 'object',
      rewrite: `{
  $$$PROPS,
  output: { assetPrefix: "auto" }
}`,
    },
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

export function hasZephyrCall(filePath: string): OperationResult {
  const result = searchWithAstGrep({
    filePath,
    pattern: 'withZephyr()',
  });

  if (result.status === 'match') {
    return { status: 'changed' };
  }

  if (result.status === 'no-match') {
    return { status: 'no-match' };
  }

  return {
    status: 'error',
    error: result.stderr || 'Failed to analyze file with ast-grep',
  };
}
