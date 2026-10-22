import type { Edit, SgNode } from '@ast-grep/napi';
import fs from 'fs';
import { parseConfigWithAstGrep } from './engine/ast-grep.js';

export const VINEXT_ZEPHYR_PLUGIN = 'vite-plugin-vinext-zephyr';
const GENERIC_VITE_ZEPHYR_PLUGIN = 'vite-plugin-zephyr';

export type VinextImportRepairResult =
  | { status: 'repaired' | 'no-change' }
  | { status: 'unsupported'; declaration: string };

interface ModuleReference {
  kind: 'import' | 'require';
  declaration: SgNode;
  source: SgNode;
}

function stringValue(node: SgNode | undefined): string | undefined {
  if (node?.kind() !== 'string') return undefined;
  return node
    .children()
    .filter((child) => child.kind() === 'string_fragment')
    .map((child) => child.text())
    .join('');
}

/**
 * Import declarations and `require()` calls of a module; comments and strings never
 * match.
 */
function findModuleReferences(root: SgNode, moduleName: string): ModuleReference[] {
  const references: ModuleReference[] = [];

  for (const declaration of root.findAll({ rule: { kind: 'import_statement' } })) {
    const source = declaration.children().find((child) => child.kind() === 'string');
    if (source && stringValue(source) === moduleName) {
      references.push({ kind: 'import', declaration, source });
    }
  }

  for (const call of root.findAll({ rule: { kind: 'call_expression' } })) {
    const [callee, args] = call.children();
    if (callee?.kind() !== 'identifier' || callee.text() !== 'require') continue;
    const argumentNodes = args?.children().filter((child) => child.isNamed()) ?? [];
    const [source] = argumentNodes;
    if (argumentNodes.length === 1 && source && stringValue(source) === moduleName) {
      references.push({ kind: 'require', declaration: call, source });
    }
  }

  return references;
}

/** Vinext apps need the Vinext-aware plugin, not the generic Vite one */
export function isVinextViteConfig(filePath: string): boolean {
  try {
    return findModuleReferences(parseConfigWithAstGrep(filePath), 'vinext').length > 0;
  } catch {
    return false;
  }
}

/** `withZephyr` is the only binding both plugins export, so only it can be moved. */
function bindsOnlyWithZephyr(reference: ModuleReference): boolean {
  if (reference.kind === 'import') {
    const children = reference.declaration.children();
    if (children.some((child) => child.kind() === 'type')) return false;
    const clause = children.find((child) => child.kind() === 'import_clause')?.children();
    if (clause?.length !== 1 || clause[0]?.kind() !== 'named_imports') return false;
    const specifiers = clause[0]
      .children()
      .filter((child) => child.kind() === 'import_specifier');
    const name = specifiers[0]?.children()[0];
    return (
      specifiers.length === 1 &&
      name?.kind() === 'identifier' &&
      name.text() === 'withZephyr'
    );
  }

  const declarator = reference.declaration.parent();
  const pattern = declarator?.children()[0];
  if (
    declarator?.kind() !== 'variable_declarator' ||
    pattern?.kind() !== 'object_pattern'
  ) {
    return false;
  }
  const properties = pattern.children().filter((child) => child.isNamed());
  const [property] = properties;
  if (properties.length !== 1 || !property) return false;
  if (property.kind() === 'shorthand_property_identifier_pattern') {
    return property.text() === 'withZephyr';
  }
  return (
    property.kind() === 'pair_pattern' && property.children()[0]?.text() === 'withZephyr'
  );
}

/**
 * Earlier codemod releases wired Vinext configs to the generic Vite plugin. Point that
 * import at the Vinext plugin so re-running the codemod repairs those projects.
 * Declarations that bind anything besides `withZephyr` are left alone: the Vinext plugin
 * does not export the generic plugin's other names, so moving them would produce an
 * invalid config.
 */
export function repairVinextZephyrImport(
  filePath: string,
  options: { dryRun?: boolean } = {}
): VinextImportRepairResult {
  const source = fs.readFileSync(filePath, 'utf8');
  const root = parseConfigWithAstGrep(filePath);
  const references = findModuleReferences(root, GENERIC_VITE_ZEPHYR_PLUGIN);
  if (references.length === 0) return { status: 'no-change' };

  const unsupported = references.find((reference) => !bindsOnlyWithZephyr(reference));
  if (unsupported) {
    return { status: 'unsupported', declaration: unsupported.declaration.text() };
  }

  const edits: Edit[] = references.map(({ source: specifier }) => {
    const quote = specifier.text()[0] ?? "'";
    return specifier.replace(`${quote}${VINEXT_ZEPHYR_PLUGIN}${quote}`);
  });
  const nextSource = root.commitEdits(edits);
  if (nextSource === source) return { status: 'no-change' };
  if (!options.dryRun) fs.writeFileSync(filePath, nextSource);
  return { status: 'repaired' };
}
