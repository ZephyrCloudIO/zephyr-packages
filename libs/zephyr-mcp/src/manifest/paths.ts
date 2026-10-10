import { SERVED_SKILL_DIRS } from './constants';

/**
 * A `/`-separated relative path: not absolute, no `\` or NUL, no empty, `.` or `..`
 * segment.
 */
export const isSafeRelativePath = (filePath: string): boolean =>
  filePath.length > 0 &&
  !filePath.startsWith('/') &&
  !filePath.includes('\\') &&
  !filePath.includes('\0') &&
  !/^[A-Za-z]:/.test(filePath) &&
  filePath
    .split('/')
    .every((segment) => segment !== '' && segment !== '.' && segment !== '..');

/** A path segment that is never uploaded or served. */
export const isExcludedSegment = (segment: string): boolean =>
  segment.startsWith('.') ||
  segment === 'node_modules' ||
  segment.toLowerCase() === 'evals';

// Paths are case-sensitive, but the deny rules match `evals`, `*.map` and
// TypeScript extensions in any case, like zephyr-agent, ze-cli, the edge and
// the Zephyr MCP: a `notes.MAP` the package served would fail the deploy.
export const isSourceMap = (filePath: string): boolean =>
  filePath.toLowerCase().endsWith('.map');

const TYPESCRIPT_SOURCE = /\.(?:ts|tsx|mts|cts)$/i;

/**
 * Why an artifact path is denied by the ZD0742 list, or `undefined`: an `evals` segment,
 * a dot segment (`..` included), a source map or a TypeScript source under `tools/`.
 * Other unsafe paths (empty segments, a leading `/`, a backslash) are not on the list;
 * {@link deniedArtifactPath} refuses them too, and checks report them as ZD0741 (contract
 * 12.3).
 */
export const listedPathDenial = (filePath: string): string | undefined => {
  const segments = filePath.split('/');
  if (segments.some((segment) => segment.toLowerCase() === 'evals')) {
    return 'has an "evals" segment';
  }
  if (segments.some((segment) => segment.startsWith('.'))) {
    return 'has a dot segment';
  }
  if (isSourceMap(filePath)) return 'is a source map';
  if (segments[0] === 'tools' && TYPESCRIPT_SOURCE.test(filePath)) {
    return 'is a TypeScript source under tools/';
  }
  return undefined;
};

/**
 * Why an artifact path may never be uploaded or read, or `undefined` when it may: the
 * ZD0742 list ({@link listedPathDenial}), then any other unsafe path.
 */
export const deniedArtifactPath = (filePath: string): string | undefined =>
  listedPathDenial(filePath) ??
  (isSafeRelativePath(filePath) ? undefined : 'is not a safe relative path');

/**
 * Whether a path relative to a skill folder is a served skill file: `SKILL.md`, or a file
 * under `references/`, `assets/` or `scripts/`, minus the excluded segments and source
 * maps.
 */
export const isServedSkillFile = (filePath: string): boolean => {
  if (filePath === 'SKILL.md') return true;
  if (!isSafeRelativePath(filePath) || isSourceMap(filePath)) return false;
  const segments = filePath.split('/');
  return (
    segments.length > 1 &&
    SERVED_SKILL_DIRS.includes(segments[0] ?? '') &&
    !segments.some(isExcludedSegment)
  );
};

/** UTF-16 code-unit order (JS `<`), never `localeCompare`. */
export const compareStrings = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;
