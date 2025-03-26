import {
  buildAssetsMap,
  getPartialAssetMap,
  removePartialAssetMap,
  ZeBuildAssetsMap,
  ZephyrEngine,
} from 'zephyr-agent';
import type { OutputAsset, OutputChunk } from 'rollup';
import { loadStaticAssets } from './load_static_assets';
import type { ZephyrInternalOptions } from '../types/zephyr-internal-options';

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
  return buildAssetsMap(complete_assets, extractBuffer, getAssetType);
}

function getAssetType(asset: OutputChunk | OutputAsset): string {
  return asset.type;
}

function extractBuffer(asset: OutputChunk | OutputAsset): string | undefined {
  switch (asset.type) {
    case 'chunk':
      return asset.code;
    case 'asset':
      return typeof asset.source === 'string'
        ? asset.source
        : new TextDecoder().decode(asset.source);
    default:
      return void 0;
  }
}
