import { readDirRecursive } from 'zephyr-agent';
import { join } from 'node:path';

/** @deprecated Import and use readDirRecursive from 'zephyr-agent' directly. */
export async function walkFiles(dir: string, prefix = ''): Promise<string[]> {
  const files = await readDirRecursive(dir);

  if (!prefix) {
    return files.map((file) => file.relativePath);
  }

  return files.map((file) => join(prefix, file.relativePath));
}
