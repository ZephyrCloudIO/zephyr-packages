import type { OutputAsset, OutputChunk } from 'rollup';
import {
  buildAssetsMap,
  getPartialAssetMap,
  removePartialAssetMap,
  type ZeBuildAssetsMap,
  type ZephyrEngine,
} from 'zephyr-agent';
import type { ZephyrInternalOptions } from '../types/zephyr-internal-options';
import { loadStaticAssets } from './load_static_assets';

export async function extract_vite_assets_map(
  zephyr_engine: ZephyrEngine,
  vite_internal_options: ZephyrInternalOptions
): Promise<ZeBuildAssetsMap> {
  const application_uid = zephyr_engine.application_uid;
  const assets = await loadStaticAssets(vite_internal_options);
  const partialAssetMap = await getPartialAssetMap(application_uid);
  await removePartialAssetMap(application_uid);

  const runtime_assets = vite_internal_options.assets;
  const complete_assets = Object.assign(
    {},
    assets,
    ...Object.values(partialAssetMap ?? {}),
    runtime_assets
  );
  const filtered_assets = Object.fromEntries(
    Object.entries(complete_assets)
      .map(toRollupOutputEntry)
      .filter((entry): entry is [string, OutputChunk | OutputAsset] => entry !== null)
  );

  return buildAssetsMap(filtered_assets, extractBuffer, getAssetType);
}

function shouldSkipAsset(assetPath: string): boolean {
  return /(^|\/)\.vite-inspect(\/|$)/.test(assetPath);
}

function isRollupOutput(asset: unknown): asset is OutputChunk | OutputAsset {
  if (!asset || typeof asset !== 'object' || !('type' in asset)) {
    return false;
  }

  return asset.type === 'chunk' || asset.type === 'asset';
}

function toRollupOutputEntry([assetPath, asset]: [string, unknown]):
  | [string, OutputChunk | OutputAsset]
  | null {
  if (shouldSkipAsset(assetPath) || !isRollupOutput(asset)) {
    return null;
  }

  return [assetPath, asset];
}

function getAssetType(asset: OutputChunk | OutputAsset): string {
  return asset.type;
}

/**
 * Extracts buffer content from Rollup assets.
 *
 * @param asset - Output chunk or asset from Rollup
 * @returns String for text-based chunks, Buffer for binary assets, undefined for unknown
 *   types
 */
function extractBuffer(asset: OutputChunk | OutputAsset): string | Buffer | undefined {
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
