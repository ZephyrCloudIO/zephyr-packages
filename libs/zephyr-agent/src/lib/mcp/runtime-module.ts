// Same semantics as `runtimeModuleProblems` in @module-federation/mcp (contract amendment
// 12.2), so every validator rejects the same runtime modules.

// Whitespace and comments between tokens: `/**/import` hides nothing.
const GAP = String.raw`(?:\s|\/\*[\s\S]*?\*\/|\/\/[^\n]*(?:\n|$))*`;
// A quote character; `\x60` is the backtick.
const QUOTE = String.raw`["'\x60]`;
// The `import` or `export` keyword as a token: not part of a name, a property
// (`x.import`) or a string (`"import"`). Keywords cannot be written with escapes.
const keyword = (word: string) => String.raw`(?<![\w$.'"\x60])${word}(?![\w$])`;
const STATIC_IMPORT = new RegExp(
  String.raw`${keyword('import')}${GAP}(?:${QUOTE}|[\w$*{][^;'"\x60]*?\bfrom${GAP}${QUOTE})`
);
const EXPORT_FROM = new RegExp(
  String.raw`${keyword('export')}${GAP}(?:\*(?:${GAP}as${GAP}[\w$]+)?|\{[^}]*\})${GAP}from${GAP}${QUOTE}`
);
const DYNAMIC_IMPORT = new RegExp(String.raw`${keyword('import')}${GAP}\(`);
const PLATFORM_MODULE = /["'`](?:node|cloudflare):/;

/**
 * Why a runtime module (`tools/index.js`) is not self-contained: a static `import`, an
 * `export ... from`, an `import()`, or a `node:*` / `cloudflare:*` reference. Empty when
 * it is.
 *
 * This reads the source text, so it guards against honest mistakes rather than acting as
 * a sandbox: the host's isolate (one module, no bindings, an egress gateway) is the
 * boundary. Any import form is reported whatever its specifier, so an escaped
 * `"\x63loudflare:sockets"` is caught as an import.
 */
export function mcpRuntimeModuleProblems(source: string): string[] {
  const problems: string[] = [];
  if (STATIC_IMPORT.test(source)) problems.push('has a static import');
  if (EXPORT_FROM.test(source)) problems.push('re-exports from another module');
  if (DYNAMIC_IMPORT.test(source)) problems.push('has a dynamic import()');
  if (PLATFORM_MODULE.test(source)) {
    problems.push('references a node:* or cloudflare:* module');
  }
  return problems;
}
