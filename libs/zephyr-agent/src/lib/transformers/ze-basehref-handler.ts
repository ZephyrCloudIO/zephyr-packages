/** Utility functions for handling baseHref paths in Zephyr */
import { ZeBuildAssetsMap, ZeBuildAsset } from 'zephyr-edge-contract';

/**
 * Normalizes a base path string to ensure consistent format across all plugins
 *
 * @param baseHref - The base path string to normalize
 * @returns A normalized base path string, or empty string for root/empty paths
 *
 *   Normalization rules:
 *
 *   - Removes leading and trailing slashes
 *   - Handles special cases like '/', './', '', '.'
 *   - Returns empty string for root or empty paths
 */
export function normalizeBasePath(baseHref: string | null | undefined): string {
  // Return empty string for falsy values
  if (!baseHref) {
    return '';
  }

  // Handle special cases that represent root path
  if (baseHref === '/' || baseHref === './' || baseHref === '.') {
    return '';
  }

  // Remove leading and trailing slashes and whitespace
  let normalized = baseHref.trim();

  // Remove leading ./ if present
  if (normalized.startsWith('./')) {
    normalized = normalized.substring(2);
  }

  // Remove leading / if present
  if (normalized.startsWith('/')) {
    normalized = normalized.substring(1);
  }

  // Remove trailing / if present
  if (normalized.endsWith('/')) {
    normalized = normalized.substring(0, normalized.length - 1);
  }

  return normalized;
}

/**
 * Determines if a path is absolute (starts with / or includes ://)
 *
 * @param path - The path to check
 * @returns True if the path is absolute, false otherwise
 */
function isAbsolutePath(path: string): boolean {
  return path.startsWith('/') || path.includes('://');
}

/**
 * Checks if a path is an index.html file
 *
 * @param path - The path to check
 * @returns True if the path is an index.html file, false otherwise
 */
function isIndexHtml(path: string): boolean {
  return path.endsWith('index.html');
}

/**
 * Applies a baseHref prefix to a path
 *
 * @param path - The original asset path
 * @param normalizedBaseHref - The normalized baseHref string
 * @returns The path with baseHref applied
 */
function applyBaseHrefToPath(path: string, normalizedBaseHref: string): string {
  // Don't modify absolute paths or index.html
  if (isAbsolutePath(path) || isIndexHtml(path)) {
    return path;
  }

  // Return original path if baseHref is empty
  if (!normalizedBaseHref) {
    return path;
  }

  // Join the baseHref and path with a slash
  return `${normalizedBaseHref}/${path}`;
}

/**
 * Transforms asset paths by applying the baseHref prefix
 *
 * @param assetsMap - The original assets map
 * @param baseHref - The baseHref to apply to asset paths
 * @returns A new assets map with updated paths
 */
export function applyBaseHrefToAssets(
  assetsMap: ZeBuildAssetsMap,
  baseHref: string | null | undefined
): ZeBuildAssetsMap {
  // If no baseHref provided or empty after normalization, return original map
  const normalizedBaseHref = normalizeBasePath(baseHref);
  if (!normalizedBaseHref) {
    return assetsMap;
  }

  // Create a new assets map with modified paths
  const result: ZeBuildAssetsMap = {};

  // Process each asset
  Object.entries(assetsMap).forEach(([key, asset]) => {
    // Create a copy of the asset
    const newAsset: ZeBuildAsset = { ...asset };

    // Apply baseHref to the asset path
    newAsset.path = applyBaseHrefToPath(asset.path, normalizedBaseHref);

    // Add to result map, keeping the same key
    result[key] = newAsset;
  });

  return result;
}
