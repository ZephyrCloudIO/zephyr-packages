import picomatch from 'picomatch';
import { ZeErrors, ZephyrError } from 'zephyr-agent';
import type { ZephyrBuildTarget } from 'zephyr-edge-contract';
import { matchDenylist } from './secret-denylist';

export type ExclusionReason =
  | 'denylist'
  | 'outside-root'
  | 'exclude'
  | 'not-included'
  | 'legacy-skip';

export interface ExcludedFile {
  path: string;
  reason: ExclusionReason;
  /** The denylist rule, exclude glob or skip pattern that removed the file. */
  rule: string;
}

export interface FileSelectionOptions {
  target?: ZephyrBuildTarget;
  /** When set, only matching files are uploaded and the legacy skip list is not used. */
  include?: readonly string[];
  /** Removes files from the included set. Only meaningful together with `include`. */
  exclude?: readonly string[];
}

/** A walked file, with where it really lives once symlinks are resolved. */
export interface SelectionInput {
  /** Path inside the upload root, using `/`. */
  path: string;
  /** Real path of the content relative to the real upload root, using `/`. */
  realPath?: string;
  /** The real path is outside the upload root (a symlink leads out of it). */
  outsideRoot?: boolean;
}

export interface FileSelection {
  selected: string[];
  excluded: ExcludedFile[];
}

/** Legacy skip list, used only when no `include` list is given. */
const LEGACY_SKIP_PATTERNS: readonly RegExp[] = [
  /\.map$/, // Source maps
  /node_modules/, // Node modules
  /\.git/, // Git files
  /\.DS_Store$/, // macOS files
  /thumbs\.db$/i, // Windows files
];

interface Matcher {
  pattern: string;
  matches: (candidate: string) => boolean;
}

function compile(patterns: readonly string[]): Matcher[] {
  return patterns.map((pattern) => ({
    pattern,
    matches: picomatch(pattern, { dot: true }),
  }));
}

function legacySkipRule(filePath: string): string | undefined {
  return LEGACY_SKIP_PATTERNS.find((pattern) => pattern.test(filePath))?.source;
}

/**
 * The single decision point for which files are uploaded. The real upload and the dry run
 * both call it, so a dry run lists exactly what an upload sends.
 *
 * Order: symlink containment, the never-upload denylist (on the walked path and on the
 * real path), then (include, exclude) when an include list is given, or the legacy skip
 * list otherwise. A `tap-app` package keeps its pass-through contract: structural rules
 * (`.git`, `node_modules`) do not apply, but a credential file or a symlink that leaves
 * the root throws instead of being omitted silently.
 */
export function selectFiles(
  inputs: readonly (string | SelectionInput)[],
  options: FileSelectionOptions = {}
): FileSelection {
  const { target, include, exclude } = options;
  const includeMatchers = include === undefined ? undefined : compile(include);
  const excludeMatchers = compile(exclude ?? []);
  const selected: string[] = [];
  const excluded: ExcludedFile[] = [];

  for (const input of inputs) {
    const { path, realPath, outsideRoot }: SelectionInput =
      typeof input === 'string' ? { path: input } : input;

    if (outsideRoot) {
      if (target === 'tap-app') {
        throw new ZephyrError(ZeErrors.ERR_UNKNOWN, {
          message: `Refusing to publish ${path}: it is a symbolic link that leads outside the upload folder. Copy the file into the package output.`,
        });
      }
      excluded.push({ path, reason: 'outside-root', rule: 'symlink' });
      continue;
    }

    const match =
      matchDenylist(path) ??
      (realPath === undefined || realPath === path ? undefined : matchDenylist(realPath));
    if (match !== undefined && !(target === 'tap-app' && match.kind === 'structural')) {
      if (target === 'tap-app') {
        throw new ZephyrError(ZeErrors.ERR_UNKNOWN, {
          message: `Refusing to publish ${path}: it matches the never-upload rule "${match.rule}". Remove it from the package output.`,
        });
      }
      excluded.push({ path, reason: 'denylist', rule: match.rule });
      continue;
    }

    if (includeMatchers === undefined) {
      // A TAP descriptor/lock can reference opaque files with conventional web-app names.
      // Do not silently omit any of them during package publication.
      const skipRule = target === 'tap-app' ? undefined : legacySkipRule(path);
      if (skipRule === undefined) {
        selected.push(path);
      } else {
        excluded.push({ path, reason: 'legacy-skip', rule: skipRule });
      }
      continue;
    }

    if (!includeMatchers.some((matcher) => matcher.matches(path))) {
      excluded.push({ path, reason: 'not-included', rule: 'include' });
      continue;
    }

    const excludeMatch = excludeMatchers.find((matcher) => matcher.matches(path));
    if (excludeMatch) {
      excluded.push({ path, reason: 'exclude', rule: excludeMatch.pattern });
      continue;
    }

    selected.push(path);
  }

  return { selected, excluded };
}
