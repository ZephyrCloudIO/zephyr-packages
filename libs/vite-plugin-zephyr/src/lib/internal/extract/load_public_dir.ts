import { basename, resolve } from 'node:path';
import type { OutputAsset } from 'rollup';
import { normalizePath } from 'vite';
import { readDirRecursiveWithContents } from 'zephyr-agent';

interface LoadPublicDirOptions {
  outDir: string;
  publicDir: string;
}

export async function load_public_dir({
  publicDir,
  outDir,
}: LoadPublicDirOptions): Promise<OutputAsset[]> {
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
        fileName: normalizePath(file.relativePath),
        originalFileName: fileName,
        originalFileNames: [fileName],
      };
    });
}
