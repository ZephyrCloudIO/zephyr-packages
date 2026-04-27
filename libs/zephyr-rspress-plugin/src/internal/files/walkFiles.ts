import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

/** @deprecated Import and use readDirRecursive from 'zephyr-agent' directly. */
export async function walkFiles(dir: string, prefix = ''): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.isSymbolicLink()) {
      continue;
    }

    const relativePath = join(prefix, entry.name);
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await walkFiles(fullPath, relativePath)));
      continue;
    }

    if (entry.isFile()) {
      files.push(relativePath);
    }
  }

  return files;
}
