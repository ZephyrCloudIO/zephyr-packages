import type { OutputAsset, OutputBundle } from 'rollup';
import { load_public_dir } from './load_public_dir';
import { load_static_entries } from './load_static_entries';
import type { ZephyrInternalOptions } from '../types/zephyr-internal-options';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { ze_log } from 'zephyr-agent';
export async function loadStaticAssets(
  vite_internal_options: ZephyrInternalOptions
): Promise<OutputBundle> {
  const publicAssets: OutputAsset[] = [];

  ze_log('loadStaticAssets.vite_internal_options: ', { vite_internal_options });
  if (vite_internal_options.publicDir) {
    const publicDirPath = resolve(
      vite_internal_options.root,
      vite_internal_options.publicDir
    );

    if (existsSync(publicDirPath)) {
      const _public_assets = await load_public_dir({
        outDir: vite_internal_options.outDir,
        publicDir: publicDirPath,
      });
      publicAssets.push(..._public_assets);
    } else {
      ze_log('Public directory not found:', publicDirPath, 'skipping...');
    }
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
