import { parseDocument } from 'yaml';

export interface ParsedMcpSkillMarkdown {
  frontmatter: Record<string, unknown>;
  body: string;
}

/**
 * Split SKILL.md per contract section 1: the first line is exactly `---` (optionally
 * followed by `\r`), the frontmatter ends at the next such line, and it must be a YAML
 * mapping. Returns `undefined` for anything else, including a leading UTF-8 BOM, which
 * the decoder keeps so the first line is not exactly `---`. ze-cli and the agent share
 * this parser so the frontmatter comparison (amendment 13.4) cannot drift.
 */
export function parseMcpSkillMarkdown(
  bytes: Uint8Array
): ParsedMcpSkillMarkdown | undefined {
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    return undefined;
  }
  const lines = text.split('\n');
  if (!isFence(lines[0])) return undefined;
  const closing = lines.findIndex((line, index) => index > 0 && isFence(line));
  if (closing < 0) return undefined;

  const document = parseDocument(
    lines
      .slice(1, closing)
      .map((line) => line.replace(/\r$/, ''))
      .join('\n'),
    { uniqueKeys: true, prettyErrors: false }
  );
  if (document.errors.length > 0) return undefined;
  let value: unknown;
  try {
    value = document.toJS({ maxAliasCount: 100 });
  } catch {
    return undefined;
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  return {
    frontmatter: value as Record<string, unknown>,
    body: lines.slice(closing + 1).join('\n'),
  };
}

/**
 * JSON with object keys sorted by UTF-16 code units, so key order never counts as a
 * difference between a SKILL.md and its catalog entry.
 */
export function canonicalMcpJson(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) =>
    typeof item === 'object' && item !== null && !Array.isArray(item)
      ? Object.fromEntries(
          Object.entries(item).sort(([left], [right]) =>
            left < right ? -1 : left > right ? 1 : 0
          )
        )
      : item
  );
}

function isFence(line: string | undefined): boolean {
  return line === '---' || line === '---\r';
}
