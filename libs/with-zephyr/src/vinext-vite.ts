import fs from 'fs';
import {
  applyEdits,
  isIdentifier,
  isStringLiteral,
  parseFile,
  type AstNode,
  type ParsedSource,
} from './engine/ast.js';

export const VINEXT_ZEPHYR_PLUGIN = 'vite-plugin-vinext-zephyr';
const GENERIC_VITE_ZEPHYR_PLUGIN = 'vite-plugin-zephyr';

export type VinextImportRepairResult =
  | { status: 'repaired' | 'no-change' }
  | { status: 'unsupported'; declaration: string };

interface ModuleReference {
  kind: 'import' | 'require';
  declaration: AstNode;
  source: AstNode;
}

/**
 * Import declarations and `require()` calls of a module; comments and strings never
 * match.
 */
function findModuleReferences(
  parsed: ParsedSource,
  moduleName: string
): ModuleReference[] {
  const references: ModuleReference[] = [];

  for (const declaration of parsed.ofType('ImportDeclaration')) {
    if (declaration.source.value === moduleName) {
      references.push({ kind: 'import', declaration, source: declaration.source });
    }
  }

  for (const call of parsed.ofType('CallExpression')) {
    if (!isIdentifier(call.callee, 'require') || call.arguments.length !== 1) continue;
    const [source] = call.arguments;
    if (isStringLiteral(source) && source.value === moduleName) {
      references.push({ kind: 'require', declaration: call, source });
    }
  }

  return references;
}

/** Vinext apps need the Vinext-aware plugin, not the generic Vite one */
export function isVinextViteConfig(filePath: string): boolean {
  try {
    return findModuleReferences(parseFile(filePath), 'vinext').length > 0;
  } catch {
    return false;
  }
}

/** `withZephyr` is the only binding both plugins export, so only it can be moved. */
function bindsOnlyWithZephyr(parsed: ParsedSource, reference: ModuleReference): boolean {
  if (reference.kind === 'import') {
    const { importKind, specifiers } = reference.declaration;
    const [specifier] = specifiers;
    return (
      importKind !== 'type' &&
      specifiers.length === 1 &&
      specifier.type === 'ImportSpecifier' &&
      specifier.importKind !== 'type' &&
      isIdentifier(specifier.imported, 'withZephyr')
    );
  }

  const declarator = parsed.parent(reference.declaration);
  if (
    declarator?.type !== 'VariableDeclarator' ||
    declarator.init !== reference.declaration ||
    declarator.id.type !== 'ObjectPattern'
  ) {
    return false;
  }
  const properties: AstNode[] = declarator.id.properties;
  const [property] = properties;
  return (
    properties.length === 1 &&
    property.type === 'Property' &&
    !property.computed &&
    isIdentifier(property.key, 'withZephyr')
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
  const parsed = parseFile(filePath);
  const references = findModuleReferences(parsed, GENERIC_VITE_ZEPHYR_PLUGIN);
  if (references.length === 0) return { status: 'no-change' };

  const unsupported = references.find(
    (reference) => !bindsOnlyWithZephyr(parsed, reference)
  );
  if (unsupported) {
    return { status: 'unsupported', declaration: parsed.text(unsupported.declaration) };
  }

  const nextSource = applyEdits(
    parsed.source,
    references.map(({ source: specifier }) => {
      const quote = parsed.text(specifier)[0] ?? "'";
      return {
        start: specifier.start,
        end: specifier.end,
        text: `${quote}${VINEXT_ZEPHYR_PLUGIN}${quote}`,
      };
    })
  );
  if (nextSource === parsed.source) return { status: 'no-change' };
  if (!options.dryRun) fs.writeFileSync(filePath, nextSource);
  return { status: 'repaired' };
}
