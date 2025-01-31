import { OutputAsset } from 'rollup';
import { readdirSync, readFile, statSync } from 'node:fs';
import { basename, relative, resolve } from 'node:path';
import { normalizePath } from 'vite';
import { promisify } from 'node:util';

interface LoadPublicDirOptions {
  outDir: string;
  publicDir: string;
}

export async function load_public_dir(
  props: LoadPublicDirOptions
): Promise<OutputAsset[]> {
  const { publicDir, outDir } = props;
  const publicAssets: OutputAsset[] = [];

  const loadDir = async (srcDir: string, destDir: string) => {
    for (const file of readdirSync(srcDir)) {
      const srcFile = resolve(srcDir, file);
      if (srcFile === destDir) {
        continue;
      }
      const destFile = resolve(destDir, file);
      const stat = statSync(srcFile);
      if (stat.isDirectory()) {
        await loadDir(srcFile, destFile);
      } else {
        publicAssets.push({
          name: basename(file),
          needsCodeReference: false,
          source: await promisify(readFile)(srcFile),
          type: 'asset',
          fileName: normalizePath(relative(outDir, destFile)),
          originalFileName: basename(file),
        });
      }
    }
  };
  await loadDir(publicDir, outDir);
  return publicAssets;
}
