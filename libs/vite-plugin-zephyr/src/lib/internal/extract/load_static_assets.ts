import type { OutputBundle } from 'rollup';
import type { ZephyrInternalOptions } from '../types/zephyr-internal-options';
import { load_public_dir } from './load_public_dir';
import { load_static_entries } from './load_static_entries';

export async function loadStaticAssets(
  vite_internal_options: ZephyrInternalOptions
): Promise<OutputBundle> {
  const bundle: OutputBundle = {};

  for await (const assets of [
    load_static_entries({
      root: vite_internal_options.root,
      outDir: vite_internal_options.outDir,
    }),

    // Only load if specified
    vite_internal_options.publicDir
      ? load_public_dir({
          outDir: vite_internal_options.outDir,
          publicDir: vite_internal_options.publicDir,
        })
      : [],
  ]) {
    for (const asset of assets) {
      bundle[asset.fileName] = asset;
    }
  }

  return bundle;
}
