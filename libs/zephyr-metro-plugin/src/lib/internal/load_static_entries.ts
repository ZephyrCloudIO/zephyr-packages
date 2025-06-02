import { readdirSync, readFile, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { promisify } from 'node:util';

interface LoadStaticEntriesOptions {
  root: string;
  outDir: string;
}

export interface OutputAsset {
  name: string;
  fileName: string;
  originalFileName: string;
  source: string | Uint8Array;
  type: 'asset';
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
      const fileName = relative(root_dist_dir, destFile);

      publicAssets.push({
        fileName,
        name: file,
        source: await promisify(readFile)(destFile),
        type: 'asset',
        originalFileName: file,
      });
    }
  };
  await loadDir(root_dist_dir);

  return publicAssets;
}
