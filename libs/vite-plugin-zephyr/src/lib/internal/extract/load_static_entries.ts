import type { OutputAsset } from 'rollup';
import { relative, resolve } from 'node:path';
import { readdirSync, readFile, statSync } from 'node:fs';
import { normalizePath } from 'vite';
import { promisify } from 'node:util';

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
