import { OutputAsset, OutputBundle } from 'rollup';
import { relative, resolve } from 'node:path';
import { readdirSync, readFile, statSync } from 'node:fs';
import { normalizePath } from 'vite';
import { promisify } from 'node:util';

interface LoadExtraFilesFromDistOptions {
  root: string;
  bundle: OutputBundle;
  outDir: string;
}

export async function load_extra_files_from_dist(props: LoadExtraFilesFromDistOptions): Promise<OutputAsset[]> {
  const { root, bundle } = props;
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
      if (!(fileName in bundle)) {
        publicAssets.push({
          fileName,
          name: file,
          needsCodeReference: false,
          source: await promisify(readFile)(destFile),
          type: 'asset',
          originalFileName: file,
        });
      }
    }
  };
  await loadDir(root_dist_dir);

  return publicAssets;
}
