import { readdirSync, readFile, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { promisify } from 'node:util';
import type { OutputAsset } from './types';

// Metro-compatible path normalization (replaces vite's normalizePath)
function normalizePath(path: string): string {
  return path.replace(/\\/g, '/');
}

interface LoadStaticEntriesOptions {
  root: string;
  outDir: string;
}

export async function load_static_entries(
  props: LoadStaticEntriesOptions
): Promise<OutputAsset[]> {
  const { root } = props;
  const publicAssets: OutputAsset[] = [];

  const root_dist_dir = resolve(root, props.outDir);

  const loadDir = async (destDir: string) => {
    for (const file of readdirSync(destDir)) {
      const destFile = resolve(destDir, file);
      const stat = statSync(destFile);
      if (stat.isDirectory()) {
        await loadDir(destFile);
        continue;
      }
      const fileName = normalizePath(relative(root_dist_dir, destFile));
      publicAssets.push({
        fileName,
        name: file,
        names: [file],
        needsCodeReference: false,
        source: await promisify(readFile)(destFile),
        type: 'asset',
        originalFileName: file,
        originalFileNames: [file],
      });
    }
  };
  await loadDir(root_dist_dir);
  return publicAssets;
}
