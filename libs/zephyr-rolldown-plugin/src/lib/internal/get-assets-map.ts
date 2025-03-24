import { OutputAsset, OutputBundle, OutputChunk } from 'rolldown';
import { 
  buildAssetsMap,
  ZeBuildAssetsMap,
  ZephyrEngine,
  ze_log
} from 'zephyr-agent';
import { applyBaseHrefToAssets } from 'zephyr-agent/src/lib/transformers/ze-basehref-handler';

/**
 * Creates an assets map from Rolldown's output bundle, applying baseHref if available
 * 
 * @param assets - Rolldown output bundle
 * @param zephyr_engine - ZephyrEngine instance containing build properties
 * @returns An assets map with paths processed according to baseHref
 */
export function getAssetsMap(
  assets: OutputBundle,
  zephyr_engine?: ZephyrEngine
): ZeBuildAssetsMap {
  // Build the initial assets map
  let assetsMap = buildAssetsMap(assets, extractBuffer, getAssetType);
  
  // Apply baseHref to asset paths if available
  if (zephyr_engine?.buildProperties?.baseHref) {
    ze_log(`Applying baseHref '${zephyr_engine.buildProperties.baseHref}' to Rolldown asset paths.`);
    assetsMap = applyBaseHrefToAssets(assetsMap, zephyr_engine.buildProperties.baseHref);
  }
  
  return assetsMap;
}

const extractBuffer = (asset: OutputChunk | OutputAsset): string | undefined => {
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
};

const getAssetType = (asset: OutputChunk | OutputAsset): string => asset.type;
