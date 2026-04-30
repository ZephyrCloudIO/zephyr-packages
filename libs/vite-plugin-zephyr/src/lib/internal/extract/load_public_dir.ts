import { basename, resolve } from 'node:path';
import { readDirRecursiveWithContents } from 'zephyr-agent';
import type { ZephyrOutputAsset } from '../types/zephyr-output.js';
import { normalizeVitePath } from '../utils/normalize-vite-path.js';

interface LoadPublicDirOptions {
  outDir: string;
  publicDir: string;
}

export async function load_public_dir({
  publicDir,
  outDir,
}: LoadPublicDirOptions): Promise<ZephyrOutputAsset[]> {
  const files = await readDirRecursiveWithContents(publicDir);
  const normalizedOutDir = resolve(outDir);

  return files
    .filter(
      (file) =>
        // Skip outDir and its contents to avoid including build outputs as public assets
        // (e.g., when publicDir = '/project' and outDir = '/project/dist')
        file.fullPath !== normalizedOutDir &&
        !file.fullPath.startsWith(normalizedOutDir + '/')
    )
    .map((file) => {
      const fileName = basename(file.fullPath);

      return {
        name: fileName,
        names: [fileName],
        needsCodeReference: false,
        source: file.content,
        type: 'asset' as const,
        fileName: normalizeVitePath(file.relativePath),
        originalFileName: fileName,
        originalFileNames: [fileName],
      };
    });
}
