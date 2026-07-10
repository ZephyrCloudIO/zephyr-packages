import type { Dirent, Stats } from 'node:fs';
import { readdir, readFile, realpath, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';

/**
 * Default path patterns that are skipped during recursive directory traversal.
 *
 * By default, any path matching one of these patterns will be excluded from results. This
 * includes:
 *
 * - `node_modules`
 * - `.git`
 * - `.DS_Store`
 * - `thumbs.db`
 */
const SKIP_PATH_PATTERNS = [
  /(^|\/)node_modules($|\/)/i,
  /(^|\/)\.git($|\/)/i,
  /(^|\/)\.DS_Store$/i,
  /(^|\/)thumbs\.db$/i,
];

export interface FileInfo {
  /**
   * Full absolute path to the file (may be outside the root directory when traversing
   * symlink targets)
   */
  fullPath: string;
  /** Relative path from the requested root directory */
  relativePath: string;
  /** File content (if requested) */
  content?: Buffer;
}

/**
 * Reads a directory recursively and returns information about all files.
 *
 * By default, paths matching a built-in skip list are not included in the results. The
 * following are always skipped:
 *
 * - Any path containing `node_modules/`
 * - Any path containing `.git/`
 * - Files named `.DS_Store`
 * - Files named `thumbs.db`
 *
 * Returns an empty array if the directory doesn't exist.
 */
export async function readDirRecursive(
  dirPath: string
): Promise<Omit<FileInfo, 'content'>[]> {
  const files: Omit<FileInfo, 'content'>[] = [];

  for await (const file of resolveDir({
    currentDir: resolve(dirPath),
    relativePrefix: '',
    readContents: false,
    activeRealDirs: new Set<string>(),
  })) {
    files.push({ fullPath: file.fullPath, relativePath: file.relativePath });
  }

  return files;
}

/**
 * Reads a directory recursively and returns file contents along with metadata.
 *
 * By default, paths matching a built-in skip list are not included in the results. The
 * following are always skipped:
 *
 * - Any path containing `node_modules/`
 * - Any path containing `.git/`
 * - Files named `.DS_Store`
 * - Files named `thumbs.db`
 *
 * Returns an empty array if the directory doesn't exist.
 */
export async function readDirRecursiveWithContents(
  dirPath: string
): Promise<Required<FileInfo>[]> {
  const files: Required<FileInfo>[] = [];

  for await (const file of resolveDir({
    currentDir: resolve(dirPath),
    relativePrefix: '',
    readContents: true,
    activeRealDirs: new Set<string>(),
  })) {
    if (file.content) {
      files.push(file as Required<FileInfo>);
    }
  }

  return files;
}

interface ResolveDirOptions {
  currentDir: string;
  relativePrefix: string;
  readContents: boolean;
  activeRealDirs: Set<string>;
}

async function* resolveDir({
  currentDir,
  relativePrefix,
  readContents,
  activeRealDirs,
}: ResolveDirOptions): AsyncGenerator<FileInfo> {
  let entries: Dirent[];

  try {
    entries = await readdir(currentDir, { withFileTypes: true });
  } catch {
    return;
  }

  const currentRealDir = await safeRealpath(currentDir);
  if (activeRealDirs.has(currentRealDir)) {
    return;
  }

  activeRealDirs.add(currentRealDir);

  try {
    for (const entry of entries) {
      const fullPath = resolve(currentDir, entry.name);
      const relativePath = relativePrefix ? join(relativePrefix, entry.name) : entry.name;
      const normalizedRelativePath = normalizePath(relativePath);

      if (shouldSkipRelativePath(normalizedRelativePath, entry)) {
        continue;
      }

      yield* resolveFile({
        fullPath,
        relativePath,
        entry,
        readContents,
        activeRealDirs,
      });
    }
  } finally {
    activeRealDirs.delete(currentRealDir);
  }
}

interface ResolveFileOptions {
  fullPath: string;
  relativePath: string;
  entry: Stats | Dirent;
  readContents: boolean;
  activeRealDirs: Set<string>;
}

async function* resolveFile({
  fullPath,
  relativePath,
  entry,
  readContents,
  activeRealDirs,
}: ResolveFileOptions): AsyncGenerator<FileInfo> {
  if (entry.isSymbolicLink()) {
    yield* resolveSymbolicLink({
      fullPath,
      relativePath,
      readContents,
      activeRealDirs,
    });
    return;
  }

  if (entry.isDirectory()) {
    yield* resolveDir({
      currentDir: fullPath,
      relativePrefix: relativePath,
      readContents,
      activeRealDirs,
    });
    return;
  }

  if (entry.isFile()) {
    const content = readContents ? await safeReadFile(fullPath) : undefined;
    if (readContents && !content) {
      return;
    }

    yield {
      fullPath,
      relativePath,
      content,
    };
  }
}

interface ResolveSymlinkOptions {
  fullPath: string;
  relativePath: string;
  readContents: boolean;
  activeRealDirs: Set<string>;
}

async function* resolveSymbolicLink({
  fullPath,
  relativePath,
  readContents,
  activeRealDirs,
}: ResolveSymlinkOptions): AsyncGenerator<FileInfo> {
  const realPath = await safeRealpath(fullPath);

  let realStat: Stats;
  try {
    realStat = await stat(realPath);
  } catch {
    return;
  }

  if (realStat.isDirectory()) {
    if (activeRealDirs.has(realPath)) {
      return;
    }

    yield* resolveDir({
      currentDir: realPath,
      relativePrefix: relativePath,
      readContents,
      activeRealDirs,
    });
    return;
  }

  if (realStat.isFile()) {
    const content = readContents ? await safeReadFile(realPath) : undefined;
    if (readContents && !content) {
      return;
    }

    yield {
      fullPath: realPath,
      relativePath,
      content,
    };
  }
}

async function safeReadFile(path: string): Promise<Buffer | undefined> {
  try {
    return await readFile(path);
  } catch {
    return undefined;
  }
}

async function safeRealpath(path: string): Promise<string> {
  try {
    return await realpath(path);
  } catch {
    return path;
  }
}

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

function shouldSkipRelativePath(relativePath: string, entry: Dirent): boolean {
  if (entry.isDirectory()) {
    return SKIP_PATH_PATTERNS.some((pattern) => pattern.test(`${relativePath}/`));
  }

  return SKIP_PATH_PATTERNS.some((pattern) => pattern.test(relativePath));
}
