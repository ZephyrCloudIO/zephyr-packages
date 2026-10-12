import { createHash } from 'node:crypto';

/** Skill and provider names: lowercase kebab case, 1 to 64 characters, never `evals`. */
export const MCP_SKILL_NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const MCP_NAME_MAX_LENGTH = 64;
/** Tool names everywhere: repo files, catalog, API and MCP. */
export const MCP_TOOL_NAME_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
/** Names owned by the Zephyr MCP itself; rejected for every provider tool. */
export const MCP_RESERVED_TOOL_NAMES: ReadonlySet<string> = new Set([
  'search',
  'execute',
  'connection_status',
]);

export const MCP_LIMITS = {
  catalogBytes: 524_288,
  skills: 200,
  tools: 200,
  /** Per skill (SEP-2640, contract amendment 11.1): files, total bytes, bytes per file. */
  filesPerSkill: 512,
  skillTotalBytes: 16 * 1024 * 1024,
  skillFileBytes: 5 * 1024 * 1024,
  runtimeModuleBytes: 10 * 1024 * 1024,
  descriptionLength: 1_024,
  compatibilityLength: 500,
  toolDescriptionLength: 2_048,
  versionLength: 64,
  evalResults: 1_000,
  evalRunnerLength: 128,
} as const;

/** Canonical agent keys (contract section 7.1). */
export const MCP_AGENT_KEYS: readonly string[] = [
  'claude-code',
  'claude',
  'codex',
  'cursor',
  'copilot',
  'gemini-cli',
  'opencode',
  'windsurf',
  'chatgpt',
  'default',
];

/** Normative extension to MIME table (contract section 2.3). */
export const MCP_MIME_TYPES: Readonly<Record<string, string>> = {
  md: 'text/markdown',
  markdown: 'text/markdown',
  txt: 'text/plain',
  json: 'application/json',
  yaml: 'application/yaml',
  yml: 'application/yaml',
  toml: 'application/toml',
  xml: 'application/xml',
  html: 'text/html',
  css: 'text/css',
  csv: 'text/csv',
  js: 'text/javascript',
  mjs: 'text/javascript',
  cjs: 'text/javascript',
  jsx: 'text/javascript',
  ts: 'text/typescript',
  tsx: 'text/typescript',
  mts: 'text/typescript',
  cts: 'text/typescript',
  py: 'text/x-python',
  sh: 'text/x-shellscript',
  bash: 'text/x-shellscript',
  rb: 'text/x-ruby',
  go: 'text/x-go',
  rs: 'text/x-rust',
  sql: 'application/sql',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  pdf: 'application/pdf',
  zip: 'application/zip',
};
export const MCP_DEFAULT_MIME_TYPE = 'application/octet-stream';

const TEXT_MIME_TYPES = new Set([
  'application/json',
  'application/yaml',
  'application/toml',
  'application/xml',
  'application/sql',
  'image/svg+xml',
]);

/** MIME type of a served file, chosen only by its lowercase extension. */
export function mcpMimeTypeForPath(path: string): string {
  const fileName = path.slice(path.lastIndexOf('/') + 1);
  const dot = fileName.lastIndexOf('.');
  if (dot <= 0 || dot === fileName.length - 1) return MCP_DEFAULT_MIME_TYPE;
  const extension = fileName.slice(dot + 1).toLowerCase();
  return Object.hasOwn(MCP_MIME_TYPES, extension)
    ? (MCP_MIME_TYPES[extension] as string)
    : MCP_DEFAULT_MIME_TYPE;
}

export function isMcpTextMimeType(mimeType: string): boolean {
  return mimeType.startsWith('text/') || TEXT_MIME_TYPES.has(mimeType);
}

/** True for a skill or provider name that satisfies the skill-name rule. */
export function isValidMcpSkillName(name: unknown): name is string {
  return (
    typeof name === 'string' &&
    name.length <= MCP_NAME_MAX_LENGTH &&
    name !== 'evals' &&
    MCP_SKILL_NAME_PATTERN.test(name)
  );
}

export function isValidMcpToolName(name: unknown): name is string {
  return typeof name === 'string' && MCP_TOOL_NAME_PATTERN.test(name);
}

/**
 * `slug(s)` from contract section 1.1. Returns `undefined` when nothing usable remains,
 * which callers must treat as an error.
 */
export function slugifyMcpName(value: string): string | undefined {
  const slug = value
    .toLowerCase()
    .replace(/^@[^/]*\//, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MCP_NAME_MAX_LENGTH)
    .replace(/^-+|-+$/g, '');
  return slug || undefined;
}

/**
 * Relative, `/`-separated, case-sensitive path without traversal, absolute roots,
 * backslashes or empty segments.
 */
export function isSafeMcpRelativePath(path: unknown): path is string {
  if (typeof path !== 'string' || path.length === 0) return false;
  if (path.startsWith('/') || path.includes('\\') || path.includes('\0')) return false;
  if (/^[A-Za-z]:/.test(path)) return false;
  return path
    .split('/')
    .every((segment) => segment !== '' && segment !== '.' && segment !== '..');
}

/**
 * Paths that are never uploaded or served (ZD0742, contract amendment 12.3): an `evals`
 * segment, source maps, dot segments, and TypeScript sources under `tools/`. Extensions
 * and `evals` match in any case, so a case-insensitive file system cannot smuggle one
 * through. A `node_modules` segment is not in this set: a catalog skill file with one is
 * not a served path (ZD0741, see `isServedMcpSkillFilePath`).
 */
export function isDeniedMcpArtifactPath(path: string): boolean {
  const segments = path.split('/');
  if (segments.some((segment) => segment.toLowerCase() === 'evals')) return true;
  if (segments.some((segment) => segment.startsWith('.'))) return true;
  if (isSourceMapPath(path)) return true;
  return segments[0] === 'tools' && /\.(?:ts|tsx|mts|cts)$/i.test(path);
}

/** Top-level entries of a skill folder whose files are served, besides `SKILL.md`. */
const SERVED_SKILL_DIRECTORIES = ['references/', 'assets/', 'scripts/'] as const;

/**
 * A skill-relative path that may be served (contract section 1): `SKILL.md`, or a file
 * under `references/`, `assets/` or `scripts/` without a `node_modules` segment. Denied
 * paths (ZD0742) are checked separately.
 */
export function isServedMcpSkillFilePath(path: string): boolean {
  return (
    path === 'SKILL.md' ||
    (SERVED_SKILL_DIRECTORIES.some((directory) => path.startsWith(directory)) &&
      !path.split('/').includes('node_modules'))
  );
}

/** `*.map` in any case. */
export function isSourceMapPath(path: string): boolean {
  return path.toLowerCase().endsWith('.map');
}

/** 64 lowercase hex characters over the raw bytes. */
export function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/** `YYYY-MM-DD` naming a real day; `Date` alone rolls 2026-02-30 over to March. */
export function isCalendarDate(value: string): boolean {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
