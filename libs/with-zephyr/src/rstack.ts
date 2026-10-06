import type { Edit, SgNode } from '@ast-grep/napi';
import fs from 'fs';
import { parseConfigWithAstGrep } from './engine/ast-grep.js';
import type { BundlerConfig, OperationResult } from './types.js';

type RstackSection = NonNullable<BundlerConfig['rstackSection']>;

function isFunctionBoundary(node: SgNode): boolean {
  return [
    'arrow_function',
    'function_expression',
    'function_declaration',
    'generator_function',
    'generator_function_declaration',
    'method_definition',
  ].includes(String(node.kind()));
}

function readConfig(filePath: string): SgNode {
  const root = parseConfigWithAstGrep(filePath);
  if (root.find({ rule: { kind: 'ERROR' } })) {
    throw new Error('Cannot parse Rstack configuration');
  }
  return root;
}

function importBindings(root: SgNode, source: string, name: string): string[] {
  const bindings: string[] = [];
  for (const statement of root.findAll({ rule: { kind: 'import_statement' } })) {
    if (statement.field('source')?.text().slice(1, -1) !== source) continue;
    if (/^import\s+type\b/.test(statement.text())) continue;
    for (const specifier of statement.findAll({ rule: { kind: 'import_specifier' } })) {
      if (specifier.field('name')?.text() !== name) continue;
      if (/^type\s/.test(specifier.text())) continue;
      bindings.push((specifier.field('alias') ?? specifier.field('name'))!.text());
    }
    for (const namespace of statement.findAll({ rule: { kind: 'namespace_import' } })) {
      const identifier = namespace.namedChildren().at(-1);
      if (identifier) bindings.push(`${identifier.text()}.${name}`);
    }
  }
  return bindings;
}

function sectionCalls(root: SgNode, section: RstackSection): SgNode[] {
  const bindings = importBindings(root, 'rstack', 'define');
  return root.findAll({ rule: { kind: 'call_expression' } }).filter((call) => {
    const callee = call.field('function');
    return (
      !call.ancestors().some(isFunctionBoundary) &&
      callee?.kind() === 'member_expression' &&
      callee.field('property')?.text() === section &&
      bindings.includes(callee.field('object')?.text() ?? '') &&
      !shadowsBinding(call, callee.field('object')!.text())
    );
  });
}

function unwrap(expression: SgNode | null): SgNode | null {
  while (
    expression &&
    ['parenthesized_expression', 'as_expression', 'satisfies_expression'].includes(
      String(expression.kind())
    )
  ) {
    expression = expression.namedChildren()[0] ?? null;
  }
  return expression;
}

function configObjects(call: SgNode): SgNode[] | null {
  const args = call
    .field('arguments')
    ?.namedChildren()
    .filter((node) => node.kind() !== 'comment');
  if (args?.length !== 1) return null;
  const config = unwrap(args[0]);
  if (config?.kind() === 'object') return [config];
  if (
    !config ||
    !['arrow_function', 'function_expression'].includes(String(config.kind()))
  ) {
    return null;
  }
  const body = unwrap(config.field('body'));
  if (body?.kind() === 'object') return [body];
  const returns = body
    ?.findAll({ rule: { kind: 'return_statement' } })
    .filter((node) => node.ancestors().find(isFunctionBoundary)?.id() === config.id());
  if (!returns?.length) return null;
  const objects = returns.map((node) => unwrap(node.namedChildren()[0] ?? null));
  return objects.every((node) => node?.kind() === 'object')
    ? (objects as SgNode[])
    : null;
}

function pluginsProperty(object: SgNode): SgNode | undefined {
  return object
    .namedChildren()
    .filter((node) => {
      if (node.kind() === 'shorthand_property_identifier')
        return node.text() === 'plugins';
      return (
        node.kind() === 'pair' &&
        ['plugins', '"plugins"', "'plugins'"].includes(node.field('key')?.text() ?? '')
      );
    })
    .at(-1);
}

function boundNames(pattern: SgNode | null): string[] {
  if (!pattern) return [];
  if (
    ['identifier', 'type_identifier', 'shorthand_property_identifier_pattern'].includes(
      String(pattern.kind())
    )
  )
    return [pattern.text()];
  if (pattern.kind() === 'pair_pattern') return boundNames(pattern.field('value'));
  if (
    pattern.kind() === 'assignment_pattern' ||
    pattern.kind() === 'object_assignment_pattern'
  )
    return boundNames(pattern.field('left'));
  if (['required_parameter', 'optional_parameter'].includes(String(pattern.kind())))
    return boundNames(pattern.field('pattern'));
  if (
    ['formal_parameters', 'object_pattern', 'array_pattern', 'rest_pattern'].includes(
      String(pattern.kind())
    )
  )
    return pattern.namedChildren().flatMap(boundNames);
  return [];
}

function isLexicalScope(node: SgNode): boolean {
  return (
    isFunctionBoundary(node) ||
    [
      'program',
      'statement_block',
      'for_statement',
      'for_in_statement',
      'catch_clause',
      'switch_body',
    ].includes(String(node.kind()))
  );
}

function visibleDeclaration(reference: SgNode, name: string): SgNode | undefined {
  const ancestors = reference.ancestors();
  const root = ancestors.at(-1)!;
  const declarations: { declaration: SgNode; scope: SgNode; names: string[] }[] = [];
  for (const declaration of root.findAll({ rule: { kind: 'variable_declarator' } })) {
    const isVar = declaration.parent()?.kind() === 'variable_declaration';
    const scope = declaration
      .ancestors()
      .find((node) =>
        isVar
          ? isFunctionBoundary(node) || node.kind() === 'program'
          : isLexicalScope(node)
      );
    if (scope)
      declarations.push({
        declaration,
        scope,
        names: boundNames(declaration.field('name')),
      });
  }
  for (const declaration of root.findAll({ rule: { kind: 'for_in_statement' } })) {
    const kind = declaration.field('kind')?.text();
    if (!kind || !['const', 'let', 'var'].includes(kind)) continue;
    const scope =
      kind === 'var'
        ? declaration
            .ancestors()
            .find((node) => isFunctionBoundary(node) || node.kind() === 'program')
        : declaration;
    if (scope)
      declarations.push({
        declaration,
        scope,
        names: boundNames(declaration.field('left')),
      });
  }
  for (const declaration of root.findAll({
    rule: {
      any: [
        { kind: 'function_declaration' },
        { kind: 'generator_function_declaration' },
        { kind: 'class_declaration' },
      ],
    },
  })) {
    const scope = declaration.ancestors().find(isLexicalScope);
    if (scope)
      declarations.push({
        declaration,
        scope,
        names: boundNames(declaration.field('name')),
      });
  }
  for (const scope of root.findAll({
    rule: {
      any: [
        { kind: 'arrow_function' },
        { kind: 'function_expression' },
        { kind: 'function_declaration' },
        { kind: 'generator_function' },
        { kind: 'generator_function_declaration' },
        { kind: 'method_definition' },
        { kind: 'catch_clause' },
      ],
    },
  })) {
    declarations.push({
      declaration: scope,
      scope,
      names: boundNames(scope.field('parameters') ?? scope.field('parameter')),
    });
    if (['function_expression', 'generator_function'].includes(String(scope.kind())))
      declarations.push({
        declaration: scope,
        scope,
        names: boundNames(scope.field('name')),
      });
  }
  for (const scope of ancestors.filter(isLexicalScope)) {
    const match = declarations.find(
      (entry) => entry.scope.id() === scope.id() && entry.names.includes(name)
    );
    if (match) return match.declaration;
  }
  return undefined;
}

function shadowsBinding(reference: SgNode, binding: string): boolean {
  return Boolean(visibleDeclaration(reference, binding.split('.')[0]));
}

function dynamicPluginBindings(reference: SgNode, plugin: string): string[] {
  const root = reference.ancestors().at(-1)!;
  const bindings: string[] = [];
  for (const declaration of root.findAll({ rule: { kind: 'variable_declarator' } })) {
    let value = declaration.field('value');
    if (value?.kind() === 'await_expression') value = value.namedChildren()[0];
    if (value?.field('function')?.text() !== 'import') continue;
    if (value.field('arguments')?.namedChildren()[0]?.text().slice(1, -1) !== plugin)
      continue;
    const pattern = declaration.field('name');
    if (pattern?.kind() !== 'object_pattern') continue;
    for (const property of pattern.namedChildren()) {
      if (
        property.text() === 'withZephyr' &&
        visibleDeclaration(reference, 'withZephyr')?.id() === declaration.id()
      )
        bindings.push('withZephyr');
      if (
        property.field('key')?.text() === 'withZephyr' &&
        property.field('value')?.kind() === 'identifier' &&
        visibleDeclaration(reference, property.field('value')!.text())?.id() ===
          declaration.id()
      )
        bindings.push(property.field('value')!.text());
    }
  }
  return bindings;
}

function registeredPluginCalls(
  object: SgNode,
  bindings: string[],
  plugin: string
): SgNode[] {
  const property = pluginsProperty(object);
  if (!property) return [];
  if (
    object
      .namedChildren()
      .some(
        (node) =>
          node.kind() === 'spread_element' &&
          node.range().start.index > property.range().start.index
      )
  )
    return [];
  const collect = (expression: SgNode | null, isList: boolean): SgNode[] => {
    const node = unwrap(expression);
    if (!node) return [];
    if (node.kind() === 'array')
      return node.namedChildren().flatMap((child) => collect(child, false));
    if (node.kind() === 'spread_element')
      return collect(node.namedChildren()[0] ?? null, true);
    if (node.kind() === 'ternary_expression')
      return [
        ...collect(node.field('consequence'), isList),
        ...collect(node.field('alternative'), isList),
      ];
    if (node.kind() === 'binary_expression') {
      const operator = node.field('operator')?.text();
      if (operator === '&&') return collect(node.field('right'), isList);
      if (operator === '||' || operator === '??')
        return [
          ...collect(node.field('left'), isList),
          ...collect(node.field('right'), isList),
        ];
    }
    if (node.kind() === 'await_expression')
      return collect(node.namedChildren()[0] ?? null, isList);
    if (isList || node.kind() !== 'call_expression') return [];
    const available = [
      ...bindings.filter((binding) => !shadowsBinding(node, binding)),
      ...dynamicPluginBindings(node, plugin),
    ];
    return available.includes(unwrap(node.field('function'))?.text() ?? '') ? [node] : [];
  };
  return collect(property.kind() === 'pair' ? property.field('value') : property, true);
}

function testGuarded(call: SgNode, envBindings: string[]): boolean {
  return call.ancestors().some((ancestor) => {
    if (ancestor.kind() !== 'ternary_expression') return false;
    const condition = unwrap(ancestor.field('condition'));
    const environment = unwrap(condition?.field('object') ?? null);
    const object = environment?.text();
    const globalProcessEnvironment =
      environment?.kind() === 'member_expression' &&
      environment.field('object')?.text() === 'process' &&
      environment.field('property')?.text() === 'env' &&
      !call
        .ancestors()
        .at(-1)!
        .findAll({ rule: { kind: 'import_statement' } })
        .some((statement) => {
          if (/^import\s+type\b/.test(statement.text())) return false;
          const clause = statement
            .namedChildren()
            .find((node) => node.kind() === 'import_clause');
          if (
            clause
              ?.namedChildren()
              .some((node) => node.kind() === 'identifier' && node.text() === 'process')
          )
            return true;
          if (
            statement
              .findAll({ rule: { kind: 'namespace_import' } })
              .some((namespace) => namespace.namedChildren().at(-1)?.text() === 'process')
          )
            return true;
          return statement
            .findAll({ rule: { kind: 'import_specifier' } })
            .some(
              (specifier) =>
                !/^type\s/.test(specifier.text()) &&
                (specifier.field('alias') ?? specifier.field('name'))?.text() ===
                  'process'
            );
        });
    const key =
      condition?.kind() === 'subscript_expression'
        ? condition.field('index')?.text().slice(1, -1)
        : condition?.field('property')?.text();
    if (
      key !== 'RSTEST' ||
      !object ||
      (!envBindings.includes(object) && !globalProcessEnvironment) ||
      shadowsBinding(call, globalProcessEnvironment ? 'process' : object)
    )
      return false;
    return Boolean(
      ancestor
        .field('alternative')
        ?.findAll({ rule: { kind: 'call_expression' } })
        .some((candidate) => candidate.id() === call.id())
    );
  });
}

function appendItem(container: SgNode, item: string): string {
  const text = container.text();
  const children = container.children().filter((node) => node.kind() !== 'comment');
  const needsComma = children.length > 2 && children.at(-2)?.kind() !== ',';
  return `${text.slice(0, -1)}\n${needsComma ? ',' : ''}${item}\n${text.at(-1)}`;
}

export function findRstackSections(filePath: string): RstackSection[] {
  const root = readConfig(filePath);
  return (['app', 'lib', 'doc'] as const).filter(
    (section) => sectionCalls(root, section).length > 0
  );
}

export function hasRstackZephyr(
  filePath: string,
  config: Pick<BundlerConfig, 'plugin' | 'rstackSection'>
): boolean {
  if (!config.rstackSection) return false;
  const root = readConfig(filePath);
  const calls = sectionCalls(root, config.rstackSection);
  const bindings = importBindings(root, config.plugin, 'withZephyr');
  const envBindings = importBindings(root, 'node:process', 'env');
  return (
    calls.length > 0 &&
    calls.every((call) => {
      const objects = configObjects(call);
      return Boolean(
        objects?.every((object) => {
          const registered = registeredPluginCalls(object, bindings, config.plugin);
          return (
            registered.length > 0 &&
            (config.rstackSection === 'doc' ||
              registered.every((pluginCall) => testGuarded(pluginCall, envBindings)))
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
    const root = readConfig(filePath);
    const calls = sectionCalls(root, config.rstackSection);
    const configs = calls.map(configObjects);
    if (configs.some((objects) => !objects)) {
      return {
        status: 'error',
        error: `Configure define.${config.rstackSection}() manually: use an inline object or a function returning inline objects.`,
      };
    }
    const bindings = importBindings(root, config.plugin, 'withZephyr');
    const objects = configs.flatMap((configObjects) => configObjects ?? []);
    const existingBinding = bindings.find((binding) =>
      objects.every((object) => !shadowsBinding(object, binding))
    );
    const identifiers = new Set(
      root
        .findAll({
          rule: {
            any: [
              { kind: 'identifier' },
              ...(/\.m?ts$/.test(filePath) ? [{ kind: 'type_identifier' }] : []),
              { kind: 'shorthand_property_identifier_pattern' },
            ],
          },
        })
        .map((node) => node.text())
    );
    const preferredBinding =
      config.rstackSection === 'doc' ? 'withZephyrRspress' : 'withZephyrRsbuild';
    let binding = existingBinding ?? preferredBinding;
    if (!existingBinding) {
      let suffix = 2;
      while (identifiers.has(binding)) binding = `${preferredBinding}${suffix++}`;
    }
    const needsTestGuard = config.rstackSection !== 'doc';
    const envBindings = importBindings(root, 'node:process', 'env');
    const existingEnvBinding = envBindings.find((candidate) =>
      objects.every((object) => !shadowsBinding(object, candidate))
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
    const edits: Edit[] = [];
    let addsPlugin = false;
    for (const object of objects) {
      const registered = registeredPluginCalls(object, bindings, config.plugin);
      if (registered.length) {
        if (needsTestGuard) {
          for (const pluginCall of registered.filter(
            (candidate) => !testGuarded(candidate, envBindings)
          ))
            edits.push(
              pluginCall.replace(
                `(${envBinding}['RSTEST'] ? undefined : ${pluginCall.text()})`
              )
            );
        }
        continue;
      }
      addsPlugin = true;
      const property = pluginsProperty(object);
      if (
        property &&
        object
          .namedChildren()
          .some(
            (node) =>
              node.kind() === 'spread_element' &&
              node.range().start.index > property.range().start.index
          )
      ) {
        return {
          status: 'error',
          error: `Configure define.${config.rstackSection}().plugins after configuration spreads so inherited plugins cannot override Zephyr.`,
        };
      }
      if (!property) {
        if (object.namedChildren().some((node) => node.kind() === 'spread_element')) {
          return {
            status: 'error',
            error: `Configure define.${config.rstackSection}().plugins explicitly before running with-zephyr on a spread configuration.`,
          };
        }
        edits.push(object.replace(appendItem(object, `plugins: [${pluginItem}]`)));
      } else {
        const value = property.kind() === 'pair' ? property.field('value')! : property;
        const array = unwrap(value);
        if (array?.kind() === 'array') {
          edits.push(array.replace(appendItem(array, pluginItem)));
        } else {
          edits.push(
            property.replace(`plugins: [...(${value.text()} ?? []), ${pluginItem}]`)
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
      const insertionPoint = root.find({ rule: { kind: 'import_statement' } })!.range()
        .start.index;
      edits.push({
        startPos: insertionPoint,
        endPos: insertionPoint,
        insertedText: importStatements.join(''),
      });
    }
    const source = fs.readFileSync(filePath, 'utf8');
    const range = root.range();
    const output = `${source.slice(0, range.start.index)}${root.commitEdits(edits)}${source.slice(range.end.index)}`;
    if (!dryRun) fs.writeFileSync(filePath, output);
    return { status: 'changed' };
  } catch (error) {
    return { status: 'error', error: (error as Error).message };
  }
}
