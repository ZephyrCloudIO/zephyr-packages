import { readDirRecursive } from 'zephyr-agent';
import { join } from 'node:path';

/** @deprecated Use readDirRecursive from 'zephyr-agent' */
export async function walkFiles(dir: string, prefix = ''): Promise<string[]> {
  const files = await readDirRecursive(dir);

  if (!prefix) {
    return files.map((file) => file.relativePath);
  }

  return files.map((file) => join(prefix, file.relativePath));
}
