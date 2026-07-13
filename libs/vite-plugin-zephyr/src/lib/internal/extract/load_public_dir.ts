import { basename, resolve } from 'node:path';
import { readDirRecursiveWithContents, type ZephyrBuildTarget } from 'zephyr-agent';
import type { ZephyrOutputAsset } from '../types/zephyr-output';
import {
  normalizeFilesystemVitePath,
  normalizeVitePath,
} from '../utils/normalize-vite-path';

interface LoadPublicDirOptions {
  outDir: string;
  publicDir: string;
  target?: ZephyrBuildTarget;
}

export async function load_public_dir({
  publicDir,
  outDir,
  target,
}: LoadPublicDirOptions): Promise<ZephyrOutputAsset[]> {
  const files =
    target === 'tap-app'
      ? await readDirRecursiveWithContents(publicDir, {
          includeIgnoredPaths: true,
          failOnError: true,
        })
      : await readDirRecursiveWithContents(publicDir);
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
        fileName:
          target === 'tap-app'
            ? normalizeFilesystemVitePath(file.relativePath)
            : normalizeVitePath(file.relativePath),
        originalFileName: fileName,
        originalFileNames: [fileName],
      };
    });
}
