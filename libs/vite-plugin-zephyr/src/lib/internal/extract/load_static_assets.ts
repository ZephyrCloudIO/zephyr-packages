import type { OutputAsset, OutputBundle } from 'rollup';
import { load_public_dir } from './load_public_dir';
import { load_static_entries } from './load_static_entries';
import type { ZephyrInternalOptions } from '../types/zephyr-internal-options';

export async function loadStaticAssets(
  vite_internal_options: ZephyrInternalOptions
): Promise<OutputBundle> {
  const publicAssets: OutputAsset[] = [];

  if (vite_internal_options.publicDir) {
    const _public_assets = await load_public_dir({
      outDir: vite_internal_options.outDir,
      publicDir: vite_internal_options.publicDir,
    });
    publicAssets.push(..._public_assets);
  }

  const _static_assets = await load_static_entries({
    root: vite_internal_options.root,
    outDir: vite_internal_options.outDir,
  });
  publicAssets.push(..._static_assets);

  return publicAssets.reduce((acc, asset) => {
    acc[asset.fileName] = asset;
    return acc;
  }, {} as OutputBundle);
}
