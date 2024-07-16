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
  console.log("\n-----------------load_public_dir--------------------\n")
  console.log("\npublicDir", publicDir, "\noutDir", outDir)
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
        loadDir(srcFile, destFile);
      } else {
        publicAssets.push({
          fileName: normalizePath(relative(outDir, destFile)),
          name: basename(file),
          needsCodeReference: false,
          source: await promisify(readFile)(srcFile),
          type: 'asset',
        });
      }
    }
  };
  await loadDir(publicDir, outDir);
  return publicAssets;
}
