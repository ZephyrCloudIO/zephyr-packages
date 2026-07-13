import { buildAssetsMap, type ZeBuildAssetsMap, type ZephyrEngine } from 'zephyr-agent';
import type { ZephyrInternalOptions } from '../types/zephyr-internal-options';
import type { ZephyrOutput } from '../types/zephyr-output';
import { loadStaticAssets } from './load_static_assets';
import { mergeViteOutputAssets } from './merge_vite_output_assets';

export async function extract_vite_assets_map(
  _zephyr_engine: ZephyrEngine,
  vite_internal_options: ZephyrInternalOptions
): Promise<ZeBuildAssetsMap> {
  const assets = await loadStaticAssets(vite_internal_options);

  const runtime_assets = vite_internal_options.assets;
  const complete_assets = { ...assets };
  mergeViteOutputAssets(complete_assets, Object.entries(runtime_assets ?? {}), {
    target: vite_internal_options.target,
  });
  const filtered_assets = Object.fromEntries(
    Object.entries(complete_assets)
      .map(toRollupOutputEntry)
      .filter((entry): entry is [string, ZephyrOutput] => entry !== null)
  );

  return buildAssetsMap(filtered_assets, extractBuffer, getAssetType);
}

function shouldSkipAsset(assetPath: string): boolean {
  return /(^|\/)\.vite-inspect(\/|$)/.test(assetPath);
}

function isBundlerOutput(asset: unknown): asset is ZephyrOutput {
  if (!asset || typeof asset !== 'object' || !('type' in asset)) {
    return false;
  }

  if (asset.type === 'chunk') {
    return 'code' in asset && typeof asset.code === 'string';
  }
  if (asset.type === 'asset' && 'source' in asset) {
    return typeof asset.source === 'string' || asset.source instanceof Uint8Array;
  }
  return false;
}

function toRollupOutputEntry([assetPath, asset]: [string, unknown]):
  | [string, ZephyrOutput]
  | null {
  if (shouldSkipAsset(assetPath) || !isBundlerOutput(asset)) {
    return null;
  }

  return [assetPath, asset];
}

function getAssetType(asset: ZephyrOutput): string {
  return asset.type;
}

/**
 * Extracts buffer content from Rollup assets.
 *
 * @param asset - Output chunk or asset from Rollup
 * @returns String for text-based chunks, Buffer for binary assets, undefined for unknown
 *   types
 */
function extractBuffer(asset: ZephyrOutput): string | Buffer | undefined {
  switch (asset.type) {
    case 'chunk':
      return asset.code;
    case 'asset':
      if (typeof asset.source === 'string') {
        return asset.source;
      }
      return Buffer.from(asset.source);
    default:
      return undefined;
  }
}
