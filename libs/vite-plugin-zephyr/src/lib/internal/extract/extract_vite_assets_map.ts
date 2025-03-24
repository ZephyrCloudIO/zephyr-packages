import {
  buildAssetsMap,
  getPartialAssetMap,
  removePartialAssetMap,
  ZeBuildAssetsMap,
  ZephyrEngine,
  ze_log,
} from 'zephyr-agent';
import { normalizeBasePath, applyBaseHrefToAssets } from 'zephyr-agent/src/lib/transformers/ze-basehref-handler';
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

  // Extract and store baseHref from Vite's base configuration
  if (vite_internal_options.base) {
    // Normalize and store baseHref in ZephyrEngine
    const normalizedBaseHref = normalizeBasePath(vite_internal_options.base);
    zephyr_engine.buildProperties.baseHref = normalizedBaseHref;
    
    if (normalizedBaseHref) {
      ze_log(`Vite baseHref detected and normalized: '${normalizedBaseHref}'`);
    }
  }

  const runtime_assets = vite_internal_options.assets;
  const complete_assets = Object.assign(
    {},
    assets,
    ...Object.values(partialAssetMap ?? {}),
    runtime_assets
  );
  
  // Build the initial assets map
  let assetsMap = buildAssetsMap(complete_assets, extractBuffer, getAssetType);
  
  // Apply baseHref to asset paths if available
  if (zephyr_engine.buildProperties.baseHref) {
    ze_log(`Applying baseHref '${zephyr_engine.buildProperties.baseHref}' to Vite asset paths.`);
    assetsMap = applyBaseHrefToAssets(assetsMap, zephyr_engine.buildProperties.baseHref);
  }
  
  return assetsMap;
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
