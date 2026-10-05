import type { Edit, SgNode } from '@ast-grep/napi';
import fs from 'fs';
import { parseConfigWithAstGrep } from './engine/ast-grep.js';
import type { BundlerConfig, OperationResult } from './types.js';

type RstackSection = NonNullable<BundlerConfig['rstackSection']>;

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
      !call
        .ancestors()
        .some((ancestor) =>
          ['arrow_function', 'function_expression', 'function_declaration'].includes(
            String(ancestor.kind())
          )
        ) &&
      callee?.kind() === 'member_expression' &&
      callee.field('property')?.text() === section &&
      bindings.includes(callee.field('object')?.text() ?? '')
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
  const returns = body?.findAll({ rule: { kind: 'return_statement' } }).filter(
    (node) =>
      node
        .ancestors()
        .find((ancestor) =>
          ['arrow_function', 'function_expression', 'function_declaration'].includes(
            String(ancestor.kind())
          )
        )
        ?.id() === config.id()
  );
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

function shadowsBinding(object: SgNode, binding: string): boolean {
  const name = binding.split('.')[0];
  const containsBinding = (node: SgNode | null): boolean =>
    node?.text() === name || Boolean(node?.namedChildren().some(containsBinding));
  return object.ancestors().some((ancestor) => {
    if (
      !['arrow_function', 'function_expression', 'function_declaration'].includes(
        String(ancestor.kind())
      )
    )
      return false;
    return (
      containsBinding(ancestor.field('parameters') ?? ancestor.field('parameter')) ||
      ancestor
        .findAll({ rule: { kind: 'variable_declarator' } })
        .some((declaration) => containsBinding(declaration.field('name')))
    );
  });
}

function dynamicPluginBindings(object: SgNode, plugin: string): string[] {
  const scopeIds = new Set(object.ancestors().map((ancestor) => ancestor.id()));
  const root = object.ancestors().at(-1)!;
  const bindings: string[] = [];
  for (const declaration of root.findAll({ rule: { kind: 'variable_declarator' } })) {
    const scope = declaration
      .ancestors()
      .find(
        (ancestor) =>
          ancestor.kind() === 'statement_block' || ancestor.kind() === 'program'
      );
    if (scope && !scopeIds.has(scope.id())) continue;
    let value = declaration.field('value');
    if (value?.kind() === 'await_expression') value = value.namedChildren()[0];
    if (value?.field('function')?.text() !== 'import') continue;
    if (value.field('arguments')?.namedChildren()[0]?.text().slice(1, -1) !== plugin)
      continue;
    const pattern = declaration.field('name');
    if (pattern?.kind() !== 'object_pattern') continue;
    for (const property of pattern.namedChildren()) {
      if (property.text() === 'withZephyr') bindings.push('withZephyr');
      if (
        property.field('key')?.text() === 'withZephyr' &&
        property.field('value')?.kind() === 'identifier'
      )
        bindings.push(property.field('value')!.text());
    }
  }
  return bindings;
}

function hasPlugin(object: SgNode, bindings: string[], plugin: string): boolean {
  const property = pluginsProperty(object);
  if (!property) return false;
  if (
    object
      .namedChildren()
      .some(
        (node) =>
          node.kind() === 'spread_element' &&
          node.range().start.index > property.range().start.index
      )
  )
    return false;
  const available = [
    ...bindings.filter((binding) => !shadowsBinding(object, binding)),
    ...dynamicPluginBindings(object, plugin),
  ];
  return property
    .findAll({ rule: { kind: 'call_expression' } })
    .some((call) => available.includes(call.field('function')?.text() ?? ''));
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
  return (
    calls.length > 0 &&
    calls.every((call) => {
      const objects = configObjects(call);
      return Boolean(
        objects?.every((object) => hasPlugin(object, bindings, config.plugin))
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
    const edits: Edit[] = [];
    for (const object of objects) {
      if (hasPlugin(object, bindings, config.plugin)) continue;
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
        edits.push(object.replace(appendItem(object, `plugins: [${binding}()]`)));
      } else {
        const value = property.kind() === 'pair' ? property.field('value')! : property;
        const array = unwrap(value);
        if (array?.kind() === 'array') {
          edits.push(array.replace(appendItem(array, `${binding}()`)));
        } else {
          edits.push(
            property.replace(`plugins: [...(${value.text()} ?? []), ${binding}()]`)
          );
        }
      }
    }
    if (!edits.length) return { status: 'no-match' };
    if (!existingBinding) {
      const importStatement = `import { withZephyr as ${binding} } from '${config.plugin}';\n`;
      const insertionPoint = root.find({ rule: { kind: 'import_statement' } })!.range()
        .start.index;
      edits.push({
        startPos: insertionPoint,
        endPos: insertionPoint,
        insertedText: importStatement,
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
