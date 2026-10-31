import fs from 'fs';
import {
  applyEdits,
  isFunction,
  isIdentifier,
  isStringLiteral,
  parseFile,
  unwrapExpression as unwrap,
  type AstNode,
  type ParsedSource,
  type TextEdit,
} from './engine/ast.js';
import type { BundlerConfig, OperationResult } from './types.js';

type RstackSection = NonNullable<BundlerConfig['rstackSection']>;

const isFunctionBoundary = isFunction;

function readConfig(filePath: string): ParsedSource {
  try {
    return parseFile(filePath);
  } catch {
    throw new Error('Cannot parse Rstack configuration');
  }
}

function valueImports(parsed: ParsedSource): AstNode[] {
  return parsed
    .ofType('ImportDeclaration')
    .filter((statement) => statement.importKind !== 'type');
}

function importBindings(parsed: ParsedSource, source: string, name: string): string[] {
  const bindings: string[] = [];
  for (const statement of valueImports(parsed)) {
    if (statement.source.value !== source) continue;
    for (const specifier of statement.specifiers as AstNode[]) {
      if (
        specifier.type === 'ImportSpecifier' &&
        specifier.importKind !== 'type' &&
        (specifier.imported.name ?? specifier.imported.value) === name
      ) {
        bindings.push(specifier.local.name);
      }
      if (specifier.type === 'ImportNamespaceSpecifier') {
        bindings.push(`${specifier.local.name}.${name}`);
      }
    }
  }
  return bindings;
}

function sectionCalls(parsed: ParsedSource, section: RstackSection): AstNode[] {
  const bindings = importBindings(parsed, 'rstack', 'define');
  return parsed.ofType('CallExpression').filter((call) => {
    const callee = call.callee;
    return (
      callee.type === 'MemberExpression' &&
      !callee.computed &&
      isIdentifier(callee.property, section) &&
      bindings.includes(parsed.text(callee.object)) &&
      !parsed.ancestors(call).some(isFunctionBoundary) &&
      !shadowsBinding(parsed, call, parsed.text(callee.object))
    );
  });
}

function configObjects(parsed: ParsedSource, call: AstNode): AstNode[] | null {
  if (call.arguments.length !== 1) return null;
  const config = unwrap(call.arguments[0]);
  if (config?.type === 'ObjectExpression') return [config];
  if (
    !config ||
    (config.type !== 'ArrowFunctionExpression' && config.type !== 'FunctionExpression')
  ) {
    return null;
  }
  const body = unwrap(config.body);
  if (body?.type === 'ObjectExpression') return [body];
  if (body?.type !== 'BlockStatement') return null;
  const returns = parsed
    .ofType('ReturnStatement')
    .filter(
      (node) =>
        node.start >= body.start &&
        node.end <= body.end &&
        parsed.ancestors(node).find(isFunctionBoundary) === config
    );
  if (!returns.length) return null;
  const objects = returns.map((node) => unwrap(node.argument));
  return objects.every((node) => node?.type === 'ObjectExpression')
    ? (objects as AstNode[])
    : null;
}

function pluginsProperty(object: AstNode): AstNode | undefined {
  return (object.properties as AstNode[])
    .filter(
      (node) =>
        node.type === 'Property' &&
        node.kind === 'init' &&
        !node.method &&
        !node.computed &&
        (isIdentifier(node.key, 'plugins') ||
          (isStringLiteral(node.key) && node.key.value === 'plugins'))
    )
    .at(-1);
}

function boundNames(pattern: AstNode | null | undefined): string[] {
  if (!pattern) return [];
  switch (pattern.type) {
    case 'Identifier':
      return pattern.name ? [pattern.name] : [];
    case 'Property':
      return boundNames(pattern.value);
    case 'AssignmentPattern':
      return boundNames(pattern.left);
    case 'RestElement':
      return boundNames(pattern.argument);
    case 'TSParameterProperty':
      return boundNames(pattern.parameter);
    case 'ObjectPattern':
      return (pattern.properties as AstNode[]).flatMap(boundNames);
    case 'ArrayPattern':
      return (pattern.elements as (AstNode | null)[]).flatMap(boundNames);
    default:
      return [];
  }
}

const LEXICAL_SCOPES = new Set([
  'Program',
  'BlockStatement',
  'ForStatement',
  'ForInStatement',
  'ForOfStatement',
  'CatchClause',
  'SwitchStatement',
]);

function isLexicalScope(node: AstNode): boolean {
  return isFunctionBoundary(node) || LEXICAL_SCOPES.has(node.type);
}

/** Per scope node: the first declaration of each name, in declaration-kind priority order. */
type ScopeIndex = Map<AstNode, Map<string, AstNode>>;

const scopeIndexes = new WeakMap<ParsedSource, ScopeIndex>();

function scopeIndex(parsed: ParsedSource): ScopeIndex {
  const cached = scopeIndexes.get(parsed);
  if (cached) return cached;
  const index: ScopeIndex = new Map();
  const declare = (scope: AstNode | undefined, declaration: AstNode, names: string[]) => {
    if (!scope) return;
    let scoped = index.get(scope);
    if (!scoped) index.set(scope, (scoped = new Map()));
    for (const name of names) if (!scoped.has(name)) scoped.set(name, declaration);
  };
  for (const declarator of parsed.ofType('VariableDeclarator')) {
    const isVar = parsed.parent(declarator)?.kind === 'var';
    const scope = parsed
      .ancestors(declarator)
      .find((node) =>
        isVar ? isFunctionBoundary(node) || node.type === 'Program' : isLexicalScope(node)
      );
    declare(scope, declarator, boundNames(declarator.id));
  }
  for (const declaration of parsed.ofType('FunctionDeclaration', 'ClassDeclaration')) {
    declare(
      parsed.ancestors(declaration).find(isLexicalScope),
      declaration,
      boundNames(declaration.id)
    );
  }
  for (const scope of parsed.nodes.filter(
    (node) => isFunctionBoundary(node) || node.type === 'CatchClause'
  )) {
    declare(
      scope,
      scope,
      scope.type === 'CatchClause'
        ? boundNames(scope.param)
        : scope.params.flatMap(boundNames)
    );
    if (scope.type === 'FunctionExpression') declare(scope, scope, boundNames(scope.id));
  }
  scopeIndexes.set(parsed, index);
  return index;
}

function visibleDeclaration(
  parsed: ParsedSource,
  reference: AstNode,
  name: string
): AstNode | undefined {
  const index = scopeIndex(parsed);
  for (const scope of parsed.ancestors(reference)) {
    if (!isLexicalScope(scope)) continue;
    const declaration = index.get(scope)?.get(name);
    if (declaration) return declaration;
  }
  return undefined;
}

function shadowsBinding(
  parsed: ParsedSource,
  reference: AstNode,
  binding: string
): boolean {
  return Boolean(visibleDeclaration(parsed, reference, binding.split('.')[0]));
}

/** `const { withZephyr } = await import(plugin)` declarators. */
function dynamicPluginImports(parsed: ParsedSource, plugin: string): AstNode[] {
  return parsed.ofType('VariableDeclarator').filter((declaration) => {
    let value = declaration.init;
    if (value?.type === 'AwaitExpression') value = value.argument;
    return (
      value?.type === 'ImportExpression' &&
      isStringLiteral(value.source) &&
      value.source.value === plugin &&
      declaration.id.type === 'ObjectPattern'
    );
  });
}

function dynamicPluginBindings(
  parsed: ParsedSource,
  reference: AstNode,
  plugin: string
): string[] {
  const bindings: string[] = [];
  for (const declaration of dynamicPluginImports(parsed, plugin)) {
    for (const property of declaration.id.properties as AstNode[]) {
      if (property.type !== 'Property' || !isIdentifier(property.key, 'withZephyr'))
        continue;
      const local = property.value;
      if (property.shorthand) {
        if (
          isIdentifier(local, 'withZephyr') &&
          visibleDeclaration(parsed, reference, 'withZephyr') === declaration
        )
          bindings.push('withZephyr');
      } else if (
        isIdentifier(local) &&
        visibleDeclaration(parsed, reference, local.name) === declaration
      ) {
        bindings.push(local.name);
      }
    }
  }
  return bindings;
}

function spreadsAfter(object: AstNode, property: AstNode): boolean {
  return (object.properties as AstNode[]).some(
    (node) => node.type === 'SpreadElement' && node.start > property.start
  );
}

function registeredPluginCalls(
  parsed: ParsedSource,
  object: AstNode,
  bindings: string[],
  plugin: string
): AstNode[] {
  const property = pluginsProperty(object);
  if (!property || spreadsAfter(object, property)) return [];
  const collect = (expression: AstNode | null, isList: boolean): AstNode[] => {
    const node = unwrap(expression);
    if (!node) return [];
    switch (node.type) {
      case 'ArrayExpression':
        return (node.elements as (AstNode | null)[]).flatMap((child) =>
          collect(child, false)
        );
      case 'SpreadElement':
        return collect(node.argument, true);
      case 'ConditionalExpression':
        return [...collect(node.consequent, isList), ...collect(node.alternate, isList)];
      case 'LogicalExpression':
        if (node.operator === '&&') return collect(node.right, isList);
        return [...collect(node.left, isList), ...collect(node.right, isList)];
      case 'AwaitExpression':
        return collect(node.argument, isList);
    }
    if (isList || node.type !== 'CallExpression') return [];
    const available = [
      ...bindings.filter((binding) => !shadowsBinding(parsed, node, binding)),
      ...dynamicPluginBindings(parsed, node, plugin),
    ];
    return available.includes(parsed.text(unwrap(node.callee))) ? [node] : [];
  };
  return collect(property.value, true);
}

/** Whether a value import (default, namespace, or named) binds `process`. */
function importsProcess(parsed: ParsedSource): boolean {
  return valueImports(parsed).some((statement) =>
    (statement.specifiers as AstNode[]).some(
      (specifier) =>
        specifier.importKind !== 'type' && isIdentifier(specifier.local, 'process')
    )
  );
}

function testGuarded(
  parsed: ParsedSource,
  call: AstNode,
  envBindings: string[]
): boolean {
  return parsed.ancestors(call).some((ancestor) => {
    if (ancestor.type !== 'ConditionalExpression') return false;
    const condition = unwrap(ancestor.test);
    if (condition?.type !== 'MemberExpression') return false;
    const environment = unwrap(condition.object);
    const object = parsed.text(environment);
    const globalProcessEnvironment =
      environment?.type === 'MemberExpression' &&
      !environment.computed &&
      isIdentifier(environment.object, 'process') &&
      isIdentifier(environment.property, 'env') &&
      !importsProcess(parsed);
    const key = condition.computed
      ? parsed.text(condition.property).slice(1, -1)
      : parsed.text(condition.property);
    if (
      key !== 'RSTEST' ||
      !object ||
      (!envBindings.includes(object) && !globalProcessEnvironment) ||
      shadowsBinding(parsed, call, globalProcessEnvironment ? 'process' : object)
    )
      return false;
    const alternate = ancestor.alternate;
    return call.start >= alternate.start && call.end <= alternate.end;
  });
}

function appendItem(parsed: ParsedSource, container: AstNode, item: string): string {
  const text = parsed.text(container);
  const items: (AstNode | null)[] =
    container.type === 'ArrayExpression' ? container.elements : container.properties;
  const last = items.at(-1);
  const trailingComma =
    items.length > 0 &&
    (!last ||
      parsed.source
        .slice(last.end, container.end - 1)
        .replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '')
        .includes(','));
  const needsComma = items.length > 0 && !trailingComma;
  return `${text.slice(0, -1)}\n${needsComma ? ',' : ''}${item}\n${text.at(-1)}`;
}

export function findRstackSections(filePath: string): RstackSection[] {
  const parsed = readConfig(filePath);
  return (['app', 'lib', 'doc'] as const).filter(
    (section) => sectionCalls(parsed, section).length > 0
  );
}

export function hasRstackZephyr(
  filePath: string,
  config: Pick<BundlerConfig, 'plugin' | 'rstackSection'>
): boolean {
  if (!config.rstackSection) return false;
  const parsed = readConfig(filePath);
  const calls = sectionCalls(parsed, config.rstackSection);
  const bindings = importBindings(parsed, config.plugin, 'withZephyr');
  const envBindings = importBindings(parsed, 'node:process', 'env');
  return (
    calls.length > 0 &&
    calls.every((call) => {
      const objects = configObjects(parsed, call);
      return Boolean(
        objects?.every((object) => {
          const registered = registeredPluginCalls(
            parsed,
            object,
            bindings,
            config.plugin
          );
          return (
            registered.length > 0 &&
            (config.rstackSection === 'doc' ||
              registered.every((pluginCall) =>
                testGuarded(parsed, pluginCall, envBindings)
              ))
          );
        })
      );
    })
  );
}

export function transformRstackSection(
  filePath: string,
  config: BundlerConfig,
  dryRun: boolean
): OperationResult {
  try {
    if (!config.rstackSection) return { status: 'no-match' };
    const parsed = readConfig(filePath);
    const calls = sectionCalls(parsed, config.rstackSection);
    const configs = calls.map((call) => configObjects(parsed, call));
    if (configs.some((objects) => !objects)) {
      return {
        status: 'error',
        error: `Configure define.${config.rstackSection}() manually: use an inline object or a function returning inline objects.`,
      };
    }
    const bindings = importBindings(parsed, config.plugin, 'withZephyr');
    const objects = configs.flatMap((configObjects) => configObjects ?? []);
    const existingBinding = bindings.find((binding) =>
      objects.every((object) => !shadowsBinding(parsed, object, binding))
    );
    const identifiers = new Set(
      parsed
        .ofType('Identifier')
        .filter((node) => parsed.isReference(node))
        .map((node) => node.name as string)
    );
    const preferredBinding =
      config.rstackSection === 'doc' ? 'withZephyrRspress' : 'withZephyrRsbuild';
    let binding = existingBinding ?? preferredBinding;
    if (!existingBinding) {
      let suffix = 2;
      while (identifiers.has(binding)) binding = `${preferredBinding}${suffix++}`;
    }
    const needsTestGuard = config.rstackSection !== 'doc';
    const envBindings = importBindings(parsed, 'node:process', 'env');
    const existingEnvBinding = envBindings.find((candidate) =>
      objects.every((object) => !shadowsBinding(parsed, object, candidate))
    );
    let envBinding = existingEnvBinding ?? 'zephyrEnv';
    if (!existingEnvBinding) {
      let suffix = 2;
      while (identifiers.has(envBinding) || envBinding === binding)
        envBinding = `zephyrEnv${suffix++}`;
    }
    const pluginItem = needsTestGuard
      ? `...(${envBinding}['RSTEST'] ? [] : [${binding}()])`
      : `${binding}()`;
    const edits: TextEdit[] = [];
    const replace = (node: AstNode, text: string) =>
      edits.push({ start: node.start, end: node.end, text });
    let addsPlugin = false;
    for (const object of objects) {
      const registered = registeredPluginCalls(parsed, object, bindings, config.plugin);
      if (registered.length) {
        if (needsTestGuard) {
          for (const pluginCall of registered.filter(
            (candidate) => !testGuarded(parsed, candidate, envBindings)
          ))
            replace(
              pluginCall,
              `(${envBinding}['RSTEST'] ? undefined : ${parsed.text(pluginCall)})`
            );
        }
        continue;
      }
      addsPlugin = true;
      const property = pluginsProperty(object);
      if (property && spreadsAfter(object, property)) {
        return {
          status: 'error',
          error: `Configure define.${config.rstackSection}().plugins after configuration spreads so inherited plugins cannot override Zephyr.`,
        };
      }
      if (!property) {
        if (
          (object.properties as AstNode[]).some((node) => node.type === 'SpreadElement')
        ) {
          return {
            status: 'error',
            error: `Configure define.${config.rstackSection}().plugins explicitly before running with-zephyr on a spread configuration.`,
          };
        }
        replace(object, appendItem(parsed, object, `plugins: [${pluginItem}]`));
      } else {
        const array = unwrap(property.value);
        if (array?.type === 'ArrayExpression') {
          replace(array, appendItem(parsed, array, pluginItem));
        } else {
          replace(
            property,
            `plugins: [...(${parsed.text(property.value)} ?? []), ${pluginItem}]`
          );
        }
      }
    }
    if (!edits.length) return { status: 'no-match' };
    const importStatements: string[] = [];
    if (!existingBinding && addsPlugin)
      importStatements.push(
        `import { withZephyr as ${binding} } from '${config.plugin}';\n`
      );
    if (needsTestGuard && !existingEnvBinding)
      importStatements.push(`import { env as ${envBinding} } from 'node:process';\n`);
    if (importStatements.length) {
      const insertionPoint = parsed.ofType('ImportDeclaration')[0]!.start;
      edits.push({
        start: insertionPoint,
        end: insertionPoint,
        text: importStatements.join(''),
      });
    }
    const output = applyEdits(parsed.source, edits);
    if (!dryRun) fs.writeFileSync(filePath, output);
    return { status: 'changed' };
  } catch (error) {
    return { status: 'error', error: (error as Error).message };
  }
}
