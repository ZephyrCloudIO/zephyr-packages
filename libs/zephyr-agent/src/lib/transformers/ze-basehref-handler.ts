import { ZeBuildAssetsMap } from 'zephyr-edge-contract';

/**
 * Applies baseHref path to all assets except index.html
 * 
 * This function is used by all bundlers (webpack, vite, rollup, rolldown) to ensure
 * consistent handling of baseHref paths. It skips modifying index.html files to ensure
 * they remain at the root.
 * 
 * @param assetsMap The original assets map
 * @param basePath The base path to apply to assets
 * @returns A new assets map with base paths applied
 */
export function applyBaseHrefToAssets(
  assetsMap: ZeBuildAssetsMap,
  basePath?: string
): ZeBuildAssetsMap {
  if (!basePath) {
    return assetsMap;
  }
  
  const result: ZeBuildAssetsMap = {};
  
  for (const [key, asset] of Object.entries(assetsMap)) {
    // Create a copy of the asset
    const newAsset = { ...asset };
    
    // Skip modifying paths for index.html
    const isIndexHtml = 
      (newAsset.path && newAsset.path.endsWith('index.html'));
    
    if (!isIndexHtml) {
      // Update the path property if not an absolute path or URL
      if (newAsset.path && !newAsset.path.startsWith('/') && !/^(https?:)?\/\//.test(newAsset.path)) {
        // Normalize base path
        let normalizedBase = basePath;
        
        // Remove leading and trailing slashes
        while (normalizedBase.startsWith('/')) {
          normalizedBase = normalizedBase.substring(1);
        }
        
        while (normalizedBase.endsWith('/')) {
          normalizedBase = normalizedBase.substring(0, normalizedBase.length - 1);
        }
        
        // Apply base path to asset path
        if (normalizedBase) {
          newAsset.path = `${normalizedBase}/${newAsset.path}`;
        }
      }
    }
    
    result[key] = newAsset;
  }
  
  return result;
}