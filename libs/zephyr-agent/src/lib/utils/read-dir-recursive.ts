import { readdir, readFile, stat } from 'node:fs/promises';
import { relative, resolve } from 'node:path';

export interface FileInfo {
  /** Full absolute path to the file */
  fullPath: string;
  /** Relative path from the root directory */
  relativePath: string;
  /** Whether this is a directory */
  isDirectory: boolean;
}

/**
 * Reads a directory recursively and returns information about all files. Returns an empty
 * array if the directory doesn't exist.
 *
 * @param dirPath - The absolute path to the directory to read
 * @returns Array of file information objects
 */
export async function readDirRecursive(dirPath: string): Promise<FileInfo[]> {
  try {
    await stat(dirPath);
  } catch {
    return [];
  }

  const entries = await readdir(dirPath, {
    recursive: true,
    withFileTypes: true,
  });

  return entries.map((entry) => ({
    fullPath: resolve(entry.parentPath ?? entry.path, entry.name),
    relativePath: relative(dirPath, resolve(entry.parentPath ?? entry.path, entry.name)),
    isDirectory: entry.isDirectory(),
  }));
}

/**
 * Reads a directory recursively and returns file contents along with metadata. Skips
 * directories and only returns actual files with their contents. Returns an empty array
 * if the directory doesn't exist.
 *
 * @param dirPath - The absolute path to the directory to read
 * @returns Array of file information with contents
 */
export async function readDirRecursiveWithContents(
  dirPath: string
): Promise<Array<FileInfo & { content: Buffer }>> {
  const files = await readDirRecursive(dirPath);
  const fileContents = await Promise.all(
    files
      .filter((file) => !file.isDirectory)
      .map(async (file) => ({
        ...file,
        content: await readFile(file.fullPath),
      }))
  );

  return fileContents;
}
