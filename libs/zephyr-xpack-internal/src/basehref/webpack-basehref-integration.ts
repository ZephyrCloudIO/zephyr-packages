/**
 * WebpackBaseHrefIntegration - Integration layer for webpack/rspack baseHref functionality
 * 
 * This file provides integration for baseHref functionality with webpack/rspack
 * and the Zephyr build process.
 */

import { detectBasePathFromWebpack, transformAssetPathsWithBase } from './basepath-handler';
import type { ZeBuildAssetsMap } from 'zephyr-edge-contract';
import { ze_log } from 'zephyr-agent';

export interface BaseHrefOptions {
  /**
   * Enable or disable the baseHref functionality
   * @default true
   */
  enabled?: boolean;

  /**
   * Override base path (overrides HtmlWebpackPlugin and output.publicPath)
   * @default undefined
   */
  path?: string;

  /**
   * Additional options for HTML base tag (if needed)
   * @default {}
   */
  baseTagOptions?: Record<string, string>;
}

/**
 * Process webpack configuration to extract base path
 * and apply it to the BuildAssetsMap
 */
export function processWebpackBaseHref(
  webpackConfig: any,
  assetsMap: ZeBuildAssetsMap,
  options?: { baseHref?: BaseHrefOptions }
): ZeBuildAssetsMap {
  // Skip if functionality is explicitly disabled
  if (options?.baseHref?.enabled === false) {
    return assetsMap;
  }

  // Detect base path from config
  const basePath = detectBasePathFromWebpack(webpackConfig, options);
  
  if (basePath) {
    ze_log(`[BaseHref] Detected base path: ${basePath}`);
    
    // Transform all asset paths to include the base path
    return transformAssetPathsWithBase(assetsMap, basePath);
  }
  
  return assetsMap;
}