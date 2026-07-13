import type { ZephyrInternalOptions } from '../types/zephyr-internal-options';
import type { ZephyrOutputBundle } from '../types/zephyr-output';
import { load_public_dir } from './load_public_dir';
import { load_static_entries } from './load_static_entries';
import { mergeViteOutputAssets } from './merge_vite_output_assets';

export async function loadStaticAssets(
  vite_internal_options: ZephyrInternalOptions
): Promise<ZephyrOutputBundle> {
  const bundle: ZephyrOutputBundle = {};

  const assetSources = [
    // Only load if specified
    vite_internal_options.publicDir
      ? load_public_dir({
          outDir: vite_internal_options.outDir,
          publicDir: vite_internal_options.publicDir,
          target: vite_internal_options.target,
        })
      : [],
    load_static_entries({
      root: vite_internal_options.root,
      outDir: vite_internal_options.outDir,
      target: vite_internal_options.target,
    }),
  ];

  for await (const assets of assetSources) {
    mergeViteOutputAssets(
      bundle,
      assets.map((asset) => [asset.fileName, asset] as const),
      { target: vite_internal_options.target }
    );
  }

  return bundle;
}
