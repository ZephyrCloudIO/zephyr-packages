import fs from 'node:fs/promises';
import path from 'node:path';
import { Source } from 'zephyr-edge-contract';
import { Stats } from '../types';

export async function walkFiles(dir: string, prefix = ''): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
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

export async function showFiles(dir: string, files: string[]): Promise<void> {
  if (files.length === 0) {
    console.warn('⚠️ No files found in output directory.');
    return;
  }

  const statTasks = files.map(async (rel) => {
    const abs = path.join(dir, rel);
    try {
      const stats = await fs.stat(abs);
      const sizeKB = (stats.size / 1024).toFixed(2);
      console.log(`📄 ${rel} — ${sizeKB} KB`);
    } catch {
      console.warn(`⚠️ Failed to stat file: ${rel}`);
    }
  });

  await Promise.all(statTasks);
}

export async function buildAssetMapFromFiles(
  root: string,
  files: string[]
): Promise<Record<string, Source>> {
  const assetEntries = await Promise.all(
    files.map(async (rel) => {
      const abs = path.join(root, rel);
      const content = await fs.readFile(abs);
      const source: Source = {
        source: () => content,
        size: () => content.length,
        buffer: () => content,
      };
      return [rel, source] as const;
    })
  );

  return Object.fromEntries(assetEntries);
}

export function buildStats(root: string, files: string[]): Stats {
  return {
    compilation: {
      options: {
        context: root,
      },
    },
    toJson: () => ({
      assets: files.map((name) => ({ name })),
    }),
  };
}
