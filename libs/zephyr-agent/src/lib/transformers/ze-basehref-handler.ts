/**
 * Utility functions for handling baseHref paths in Zephyr
 */

/**
 * Normalizes a base path string to ensure consistent format across all plugins
 * 
 * @param baseHref - The base path string to normalize
 * @returns A normalized base path string, or empty string for root/empty paths
 * 
 * Normalization rules:
 * - Removes leading and trailing slashes
 * - Handles special cases like '/', './', '', '.'
 * - Returns empty string for root or empty paths
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