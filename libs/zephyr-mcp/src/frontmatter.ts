import { parse, stringify } from 'yaml';

export interface ParsedSkillMarkdown {
  frontmatter: Record<string, unknown>;
  body: string;
}

const isDelimiter = (line: string) => line === '---' || line === '---\r';

/**
 * Splits `SKILL.md` into its YAML frontmatter source and body. The file must start with a
 * line that is exactly `---` (optionally followed by `\r`), and the frontmatter ends at
 * the next such line. Returns `undefined` otherwise.
 */
export const splitFrontmatter = (
  markdown: string
): { yaml: string; body: string } | undefined => {
  const firstBreak = markdown.indexOf('\n');
  if (firstBreak === -1 || !isDelimiter(markdown.slice(0, firstBreak))) {
    return undefined;
  }
  let start = firstBreak + 1;
  while (start <= markdown.length) {
    const end = markdown.indexOf('\n', start);
    const line = markdown.slice(start, end === -1 ? undefined : end);
    if (isDelimiter(line)) {
      return {
        yaml: markdown.slice(firstBreak + 1, start),
        body: end === -1 ? '' : markdown.slice(end + 1),
      };
    }
    if (end === -1) return undefined;
    start = end + 1;
  }
  return undefined;
};

export const parseSkillMarkdown = (markdown: string): ParsedSkillMarkdown => {
  const source = markdown.replace(/^\uFEFF/, '');
  const split = splitFrontmatter(source);
  if (!split) {
    throw new Error(
      'SKILL.md must start with a YAML frontmatter block (---\\nname: ...\\ndescription: ...\\n---)'
    );
  }
  const frontmatter: unknown = parse(split.yaml);
  if (!frontmatter || typeof frontmatter !== 'object' || Array.isArray(frontmatter)) {
    throw new Error('SKILL.md frontmatter must be a YAML mapping');
  }
  return {
    frontmatter: frontmatter as Record<string, unknown>,
    body: split.body,
  };
};

export const renderSkillMarkdown = (
  frontmatter: Record<string, unknown>,
  body: string
): string => {
  const defined = Object.fromEntries(
    Object.entries(frontmatter).filter(([, value]) => value !== undefined)
  );
  return `---\n${stringify(defined, { lineWidth: 0 }).trimEnd()}\n---\n\n${body.trim()}\n`;
};
