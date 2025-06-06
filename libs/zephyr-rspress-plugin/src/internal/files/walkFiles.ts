import fs from 'node:fs/promises';
import path from 'node:path';

export async function walkFiles(dir: string, prefix = ''): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;

    const rel = path.join(prefix, entry.name);
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await walkFiles(full, rel)));
    } else {
      files.push(rel);
    }
  }

  return files;
}
