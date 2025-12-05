import { bold, dim, gray, green, purple, yellow } from './picocolor';

type Tone = 'info' | 'warn' | 'success' | 'muted';

const INDENT = '  ';

const toneAccent: Record<Tone, (value: string) => string> = {
  info: purple,
  warn: yellow,
  success: green,
  muted: gray,
};

const defaultTone: Tone = 'info';

interface SectionOptions {
  title?: string;
  subtitle?: string;
  body?: string[];
  tone?: Tone;
}

const indentLine = (line: string): string => {
  if (!line) return '';
  return `${INDENT}${line}`;
};

/**
 * Renders a consistent multi-line section that will be prefixed by the ZEPHYR tag. Titles
 * are accented, optional subtitles are muted, and body lines are indented.
 */
export function renderSection(options: SectionOptions): string {
  const { title, subtitle, body = [], tone = defaultTone } = options;
  const accent = toneAccent[tone] ?? toneAccent[defaultTone];

  const lines: string[] = [];

  if (title) {
    lines.push(accent(bold(title)));
  }

  if (subtitle) {
    lines.push(indentLine(dim(subtitle)));
  }

  if (body.length) {
    lines.push(
      ...body.filter((line): line is string => typeof line === 'string').map(indentLine)
    );
  }

  return lines.join('\n');
}

export interface KeyValueRow {
  label: string;
  value: string;
}

export function renderKeyValueRows(rows: KeyValueRow[]): string[] {
  if (!rows.length) return [];

  const maxLabelLength = Math.max(...rows.map(({ label }) => label.length));

  return rows.map(({ label, value }) => {
    const paddedLabel = label.padEnd(maxLabelLength, ' ');
    return `${gray(paddedLabel)}  ${value}`;
  });
}

export function renderList(items: string[]): string[] {
  return items.map((item) => `- ${item}`);
}

export function joinSections(sections: Array<string | undefined>): string {
  return sections.filter((section): section is string => Boolean(section)).join('\n');
}
