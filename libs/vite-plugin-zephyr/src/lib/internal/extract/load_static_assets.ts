import type { ZephyrInternalOptions } from '../types/zephyr-internal-options.js';
import type { ZephyrOutputBundle } from '../types/zephyr-output.js';
import { load_public_dir } from './load_public_dir.js';
import { load_static_entries } from './load_static_entries.js';

export async function loadStaticAssets(
  vite_internal_options: ZephyrInternalOptions
): Promise<ZephyrOutputBundle> {
  const bundle: ZephyrOutputBundle = {};

  for await (const assets of [
    // Only load if specified
    vite_internal_options.publicDir
      ? load_public_dir({
          outDir: vite_internal_options.outDir,
          publicDir: vite_internal_options.publicDir,
        })
      : [],
    load_static_entries({
      root: vite_internal_options.root,
      outDir: vite_internal_options.outDir,
    }),
  ]) {
    for (const asset of assets) {
      bundle[asset.fileName] = asset;
    }
  }

  return bundle;
}
