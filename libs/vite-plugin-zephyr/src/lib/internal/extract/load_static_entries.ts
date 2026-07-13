import { basename, resolve } from 'node:path';
import { readDirRecursiveWithContents, type ZephyrBuildTarget } from 'zephyr-agent';
import type { ZephyrOutputAsset } from '../types/zephyr-output';
import {
  normalizeFilesystemVitePath,
  normalizeVitePath,
} from '../utils/normalize-vite-path';

interface LoadStaticEntriesOptions {
  root: string;
  outDir: string;
  target?: ZephyrBuildTarget;
}

export async function load_static_entries(
  props: LoadStaticEntriesOptions
): Promise<ZephyrOutputAsset[]> {
  const root_dist_dir = resolve(props.root, props.outDir);
  // Load all files from the output directory - no filtering needed since
  // we're intentionally reading build outputs, not public assets
  const files =
    props.target === 'tap-app'
      ? await readDirRecursiveWithContents(root_dist_dir, {
          includeIgnoredPaths: true,
          failOnError: true,
        })
      : await readDirRecursiveWithContents(root_dist_dir);

  return files.map((file) => {
    const fileName = basename(file.fullPath);

    return {
      fileName:
        props.target === 'tap-app'
          ? normalizeFilesystemVitePath(file.relativePath)
          : normalizeVitePath(file.relativePath),
      name: fileName,
      names: [fileName],
      needsCodeReference: false,
      source: file.content,
      type: 'asset' as const,
      originalFileName: fileName,
      originalFileNames: [fileName],
    };
  });
}
