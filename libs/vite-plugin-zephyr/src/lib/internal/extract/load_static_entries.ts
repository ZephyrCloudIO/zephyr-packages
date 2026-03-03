import type { OutputAsset } from 'rollup';
import { basename, resolve } from 'node:path';
import { normalizePath } from 'vite';
import { readDirRecursiveWithContents } from 'zephyr-agent';

interface LoadStaticEntriesOptions {
  root: string;
  outDir: string;
}

export async function load_static_entries(
  props: LoadStaticEntriesOptions
): Promise<OutputAsset[]> {
  const root_dist_dir = resolve(props.root, props.outDir);
  // Load all files from the output directory - no filtering needed since
  // we're intentionally reading build outputs, not public assets
  const files = await readDirRecursiveWithContents(root_dist_dir);

  return files.map((file) => {
    const fileName = basename(file.fullPath);

    return {
      fileName: normalizePath(file.relativePath),
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
