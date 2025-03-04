import { OutputAsset, OutputBundle, OutputChunk, NormalizedOutputOptions } from 'rolldown';
import { applyBaseHrefToAssets, buildAssetsMap, ZeBuildAssetsMap, ze_log } from 'zephyr-agent';

export function getAssetsMap(assets: OutputBundle, options?: NormalizedOutputOptions): ZeBuildAssetsMap {
  // Build the base assets map
  const assetsMap = buildAssetsMap(assets, extractBuffer, getAssetType);
  
  // Check for base path in Rolldown options
  if (options && options.dir) {
    // Rolldown uses similar patterns to Rollup
    // We'll check if dir contains any path information that could be a base
    const dirPath = options.dir || '';
    const basePath = dirPath.includes('/') ? dirPath.substring(dirPath.lastIndexOf('/') + 1) : '';
    
    if (basePath && basePath !== '/' && basePath !== './') {
      ze_log(`[BaseHref] Detected Rolldown base path: ${basePath}`);
      
      // Apply base path to all assets except index.html
      return applyBaseHrefToAssets(assetsMap, basePath);
    }
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
