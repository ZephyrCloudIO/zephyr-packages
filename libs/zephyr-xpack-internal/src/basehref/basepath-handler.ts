/**
 * BasePathHandler - Core utility for path normalization and detection
 * 
 * This file provides the base path normalization and path joining functionality
 * for handling baseHref in webpack, rspack, and other bundlers.
 */

/**
 * Normalize a base path by:
 * - Removing leading and trailing slashes
 * - Handling special cases like empty strings, '.', etc.
 */
export function normalizeBasePath(basePath: string): string {
  if (!basePath || basePath === '/' || basePath === './' || basePath === '.') {
    return '';
  }

  // Remove leading and trailing slashes
  let normalized = basePath;
  
  // Remove leading slash(es)
  while (normalized.startsWith('/')) {
    normalized = normalized.substring(1);
  }
  
  // Remove trailing slash(es)
  while (normalized.endsWith('/')) {
    normalized = normalized.substring(0, normalized.length - 1);
  }

  return normalized;
}

/**
 * Join a base path with an asset path, ensuring:
 * - No double slashes
 * - Proper handling of empty base paths
 * - Absolute asset paths are not modified
 */
export function joinBasePath(basePath: string, assetPath: string): string {
  // Handle empty asset path
  if (!assetPath) {
    return assetPath;
  }
  
  // If asset path is absolute (starts with /) or is a URL, don't prefix
  if (assetPath.startsWith('/') || /^(https?:)?\/\//.test(assetPath)) {
    return assetPath;
  }
  
  // Normalize base path
  const normalizedBase = normalizeBasePath(basePath);
  
  // If normalized base is empty, return original asset path
  if (!normalizedBase) {
    return assetPath;
  }
  
  // Ensure no double slashes when joining paths
  return `${normalizedBase}/${assetPath}`;
}

/**
 * Detect base path from different sources in webpack/rspack configuration
 * Returns the base path according to priority:
 * 1. Explicit plugin baseHref configuration
 * 2. HTML Webpack Plugin's base.href configuration
 * 3. Webpack/Rspack's output.publicPath
 * 4. Default to empty string if none found
 */
export function detectBasePathFromWebpack(
  config: any,
  pluginOptions?: { baseHref?: { path?: string } }
): string {
  // Priority 1: Check plugin options first
  if (pluginOptions?.baseHref?.path) {
    return pluginOptions.baseHref.path;
  }
  
  // Priority 2: Check HtmlWebpackPlugin configuration
  if (config.plugins) {
    const htmlPlugins = config.plugins.filter((plugin: any) => 
      plugin && plugin.constructor && plugin.constructor.name === 'HtmlWebpackPlugin');

    for (const plugin of htmlPlugins) {
      if (plugin.options?.base?.href) {
        return plugin.options.base.href;
      }
    }
  }
  
  // Priority 3: Check webpack/rspack output.publicPath
  if (config.output?.publicPath && config.output.publicPath !== 'auto') {
    return config.output.publicPath;
  }
  
  // Default
  return '';
}

/**
 * Transform a webpack asset map to include base path prefix for all assets
 */
export function transformAssetPathsWithBase(
  assetsMap: Record<string, any>, 
  basePath?: string
): Record<string, any> {
  if (!basePath) {
    return assetsMap;
  }
  
  const result: Record<string, any> = {};
  
  for (const [key, asset] of Object.entries(assetsMap)) {
    // Create a copy of the asset
    const newAsset = { ...asset };
    
    // Update the filepath with the base path
    if (newAsset.filepath) {
      newAsset.filepath = joinBasePath(basePath, newAsset.filepath);
    }
    
    result[key] = newAsset;
  }
  
  return result;
}