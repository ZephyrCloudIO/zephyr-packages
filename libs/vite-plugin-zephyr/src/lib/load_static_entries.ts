import { OutputAsset, OutputBundle } from 'rollup';
import { relative, resolve } from 'node:path';
import { readdirSync, readFile, statSync } from 'node:fs';
import { normalizePath } from 'vite';
import { promisify } from 'node:util';

interface LoadStaticEntriesOptions {
  root: string;
  bundle: OutputBundle;
}

const files_to_load: Record<string, boolean> = {
  'index.html': true,
  '404.html': true,
  'q-data.json': true,
};

export async function load_static_entries(
  props: LoadStaticEntriesOptions
): Promise<OutputAsset[]> {
  const { root, bundle } = props;
  const publicAssets: OutputAsset[] = [];

  const root_dist_dir = resolve(root, 'dist');

  const loadDir = async (destDir: string) => {
    for (const file of readdirSync(destDir)) {
      const destFile = resolve(destDir, file);
      const stat = statSync(destFile);
      if (stat.isDirectory()) {
        await loadDir(destFile);
        continue;
      }
      const fileName = normalizePath(relative(root_dist_dir, destFile));
      if (files_to_load[file]) {
        publicAssets.push({
          fileName,
          name: file,
          needsCodeReference: false,
          source: await promisify(readFile)(destFile),
          type: 'asset',
        });
      }
    }
  };
  await loadDir(root_dist_dir);
  return publicAssets;
}
