/**
 * Remote Resolution Module - Phase 2.1
 * 
 * This module provides utilities for resolving remote packages
 * using URL-safe encoded package names.
 */

import { decodePackageName, encodePackageName } from './url-encoding';

/**
 * Interface representing a resolved remote package
 */
export interface ResolvedRemote {
  packageName: string;  // Original (decoded) package name
  version: string;      // Package version
  url: string;          // Full URL to the package
  cdnUsed?: string;     // Which CDN was used (for debugging)
}

/**
 * Options for remote resolution
 */
export interface RemoteResolutionOptions {
  timeout?: number;       // Timeout in milliseconds
  retries?: number;       // Number of retries
  baseUrl?: string;       // Override default CDN URL
  fallbackUrls?: string[]; // Override fallback CDN URLs
}

/**
 * Default options for remote resolution
 */
const DEFAULT_OPTIONS: RemoteResolutionOptions = {
  timeout: 5000,
  retries: 3
};

/**
 * Default CDN base URL for remote package resolution
 */
const DEFAULT_CDN_URL = 'https://zephyr-cdn.org';

/**
 * Fallback CDN URLs to try if the primary CDN is unavailable
 */
const FALLBACK_CDN_URLS = [
  'https://zephyr-cdn-fallback.org',
  'https://zephyr-cdn-backup.org'
];

/**
 * Cache for remote resolutions to avoid redundant network requests
 * Format: encodedPackageName@version -> ResolvedRemote
 */
const resolutionCache = new Map<string, ResolvedRemote>();

/**
 * Maximum cache size to prevent memory leaks
 */
const MAX_RESOLUTION_CACHE_SIZE = 500;

/**
 * Adds an item to the resolution cache, maintaining the maximum cache size
 * 
 * @param key The cache key (encodedPackageName@version)
 * @param value The resolved remote value
 */
function addToResolutionCache(key: string, value: ResolvedRemote): void {
  if (resolutionCache.size >= MAX_RESOLUTION_CACHE_SIZE) {
    const firstKey = resolutionCache.keys().next().value;
    resolutionCache.delete(firstKey);
  }
  resolutionCache.set(key, value);
}

/**
 * Validates input parameters for remote resolution
 * 
 * @param encodedPackageName The encoded package name
 * @param version The package version
 * @throws If inputs are invalid
 */
function validateInputs(encodedPackageName: string, version: string): void {
  if (!encodedPackageName) {
    throw new Error('Encoded package name cannot be empty');
  }
  
  if (!version) {
    throw new Error('Version cannot be empty');
  }
  
  // Additional validations could be added here
}

/**
 * Generates a URL for a remote package using its encoded package name
 * 
 * @param encodedPackageName The URL-safe encoded package name
 * @param version The package version
 * @param baseUrl The base URL for the CDN (defaults to the primary CDN)
 * @returns The generated URL
 */
export function generateRemoteUrl(
  encodedPackageName: string,
  version: string,
  baseUrl: string = DEFAULT_CDN_URL
): string {
  validateInputs(encodedPackageName, version);
  
  // Ensure the base URL doesn't have a trailing slash
  const normalizedBaseUrl = baseUrl.endsWith('/')
    ? baseUrl.slice(0, -1)
    : baseUrl;
  
  // Handle special characters in the version
  // In a real URL, @ and : have special meaning, so we need to handle them
  // especially when they're present in the version string
  const encodedVersion = encodeURIComponent(version);
  
  // Generate the URL, ensuring the encoded package name is used directly
  // to maintain URL safety
  return `${normalizedBaseUrl}/${encodedPackageName}@${encodedVersion}`;
}

/**
 * Resolves a remote package using its encoded package name
 * 
 * @param encodedPackageName The URL-safe encoded package name
 * @param version The package version to resolve
 * @param options Optional resolution options
 * @returns A promise resolving to the remote package information
 */
export async function resolveRemote(
  encodedPackageName: string,
  version: string,
  options: RemoteResolutionOptions = {}
): Promise<ResolvedRemote> {
  validateInputs(encodedPackageName, version);
  
  // Merge default options with provided options
  const resolveOptions = { ...DEFAULT_OPTIONS, ...options };
  
  // Create cache key
  const cacheKey = `${encodedPackageName}@${version}`;
  
  // Check cache first
  if (resolutionCache.has(cacheKey)) {
    return resolutionCache.get(cacheKey)!;
  }
  
  try {
    // Use provided base URL or default
    const baseUrl = resolveOptions.baseUrl || DEFAULT_CDN_URL;
    
    // Generate the URL for the package
    const url = generateRemoteUrl(encodedPackageName, version, baseUrl);
    
    // Decode the package name to get the original name
    const packageName = decodePackageName(encodedPackageName);
    
    // In a real implementation, we would fetch the package from the CDN here
    // with timeout and retry logic based on resolveOptions
    // For test purposes, we'll just return the resolved information
    const result: ResolvedRemote = {
      packageName,
      version,
      url,
      cdnUsed: baseUrl
    };
    
    // Cache the successful resolution
    addToResolutionCache(cacheKey, result);
    
    return result;
  } catch (error) {
    throw new Error(`Failed to resolve remote package: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Resolves a remote package with fallback options using its encoded package name
 * 
 * @param encodedPackageName The URL-safe encoded package name
 * @param version The package version to resolve
 * @param options Optional resolution options
 * @returns A promise resolving to the remote package information
 */
export async function resolveRemoteWithFallback(
  encodedPackageName: string,
  version: string,
  options: RemoteResolutionOptions = {}
): Promise<ResolvedRemote> {
  validateInputs(encodedPackageName, version);
  
  // Merge default options with provided options
  const resolveOptions = { ...DEFAULT_OPTIONS, ...options };
  
  // Create cache key
  const cacheKey = `${encodedPackageName}@${version}`;
  
  // Check cache first
  if (resolutionCache.has(cacheKey)) {
    return resolutionCache.get(cacheKey)!;
  }
  
  // Try the primary CDN first
  try {
    const result = await resolveRemote(encodedPackageName, version, resolveOptions);
    
    // Cache the successful resolution
    addToResolutionCache(cacheKey, result);
    
    return result;
  } catch (primaryError) {
    // Primary CDN failed, try fallbacks in order
    const fallbackUrls = resolveOptions.fallbackUrls || FALLBACK_CDN_URLS;
    
    for (const fallbackUrl of fallbackUrls) {
      try {
        // Try with this fallback URL
        const fallbackOptions = { ...resolveOptions, baseUrl: fallbackUrl };
        const result = await resolveRemote(encodedPackageName, version, fallbackOptions);
        
        // Cache the successful resolution
        addToResolutionCache(cacheKey, result);
        
        return result;
      } catch (fallbackError) {
        // This fallback failed, continue to the next one
        continue;
      }
    }
    
    // All fallbacks failed, throw the original error with more context
    throw new Error(
      `Failed to resolve package ${decodePackageName(encodedPackageName)}@${version} from all CDNs. ` +
      `Original error: ${primaryError instanceof Error ? primaryError.message : String(primaryError)}`
    );
  }
}