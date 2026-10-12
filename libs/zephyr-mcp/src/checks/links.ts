const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const INLINE_LINK = /!?\[[^\]]*\]\(\s*(<[^>]*>|[^)\s]+)[^)]*\)/g;
const REFERENCE_DEFINITION = /^ {0,3}\[[^\]]+\]:\s*(<[^>]*>|\S+)/;
const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

// Markdown outside fenced code blocks and inline code spans, with 1-based
// line numbers.
const proseLines = (markdown: string): Array<{ text: string; line: number }> => {
  const lines: Array<{ text: string; line: number }> = [];
  let fence: string | undefined;
  markdown.split(/\r?\n/).forEach((line, index) => {
    const marker = FENCE.exec(line)?.[1];
    if (fence) {
      if (marker && marker[0] === fence[0] && marker.length >= fence.length) {
        fence = undefined;
      }
      return;
    }
    if (marker) {
      fence = marker;
      return;
    }
    lines.push({
      text: line.replace(/(`+)[\s\S]*?\1/g, ''),
      line: index + 1,
    });
  });
  return lines;
};

/**
 * Relative link and image targets in Markdown, without query or fragment, with the line
 * each is on.
 */
export const relativeLinkTargets = (
  markdown: string
): Array<{ target: string; line: number }> => {
  const targets: Array<{ target: string; line: number }> = [];
  let line = 0;
  const add = (raw: string) => {
    let target = raw.startsWith('<') ? raw.slice(1, -1) : raw;
    if (
      !target ||
      target.startsWith('#') ||
      target.startsWith('/') ||
      SCHEME.test(target)
    ) {
      return;
    }
    target = target.replace(/[?#].*$/, '');
    try {
      target = decodeURIComponent(target);
    } catch {
      // Keep a target that is not valid percent-encoding as written.
    }
    if (target) targets.push({ target, line });
  };
  for (const prose of proseLines(markdown)) {
    line = prose.line;
    for (const match of prose.text.matchAll(INLINE_LINK)) add(match[1] ?? '');
    const definition = REFERENCE_DEFINITION.exec(prose.text);
    if (definition) add(definition[1] ?? '');
  }
  return targets;
};

/** Resolves a target relative to the skill folder. `undefined` when it leaves the folder. */
export const resolveInSkill = (target: string): string | undefined => {
  const resolved: string[] = [];
  for (const segment of target.split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') {
      if (resolved.length === 0) return undefined;
      resolved.pop();
    } else {
      resolved.push(segment);
    }
  }
  return resolved.join('/');
};

/**
 * Relative links in `SKILL.md` that leave the skill folder or do not resolve to a served
 * file (contract ZD0716). A folder is not a file: `references/` is broken even when files
 * under it are served, as ze-cli reports it.
 */
export const brokenLinks = (
  markdown: string,
  served: ReadonlySet<string>
): Array<{ line: number; reason: 'outside' | 'not-served' }> => {
  const broken: Array<{ line: number; reason: 'outside' | 'not-served' }> = [];
  for (const { target, line } of relativeLinkTargets(markdown)) {
    const resolved = resolveInSkill(target);
    if (resolved === undefined) {
      broken.push({ line, reason: 'outside' });
      continue;
    }
    if (!target.endsWith('/') && served.has(resolved)) continue;
    broken.push({ line, reason: 'not-served' });
  }
  return broken;
};
