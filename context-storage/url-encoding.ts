/**
 * URL Encoding Module - Phase 2.1
 * 
 * This module provides utilities for encoding and decoding package names
 * to ensure they are URL-safe while preserving their structure.
 */

// Cache for frequently used package names to improve performance
const encodeCache = new Map<string, string>();
const decodeCache = new Map<string, string>();

// Maximum cache size to prevent memory leaks
const MAX_CACHE_SIZE = 1000;

/**
 * Regular expression for detecting percent-encoded characters
 * More optimized version for performance
 */
const ENCODED_PATTERN = /(?:%[0-9A-Fa-f]{2})+/;

/**
 * Regular expression for common scoped package pattern
 * Used for fast-path optimization
 */
const SCOPED_PACKAGE_PATTERN = /^@[\w-]+\/[\w-]+$/;

/**
 * Checks if a string is likely already encoded
 * 
 * @param str The string to check
 * @returns True if the string appears to be already encoded
 */
function isLikelyEncoded(str: string): boolean {
  return ENCODED_PATTERN.test(str);
}

/**
 * Adds an item to the cache, maintaining the maximum cache size
 * 
 * @param cache The cache Map to add to
 * @param key The key to add
 * @param value The value to add
 */
function addToCache<K, V>(cache: Map<K, V>, key: K, value: V): void {
  // If cache is at max size, remove oldest entry (first in map)
  if (cache.size >= MAX_CACHE_SIZE) {
    const firstKey = cache.keys().next().value;
    if (firstKey !== undefined) {
      cache.delete(firstKey);
    }
  }
  cache.set(key, value);
}

/**
 * Specialized encoder for common package patterns
 * 
 * @param packageName The package name to encode
 * @returns The encoded package name if a fast path was available, null otherwise
 */
function fastPathEncode(packageName: string): string | null {
  // Fast path for common scoped package pattern (@scope/name)
  if (SCOPED_PACKAGE_PATTERN.test(packageName)) {
    return `%40${packageName.substring(1)}`;
  }
  
  // No fast path available
  return null;
}

/**
 * Encodes a package name to make it URL-safe.
 * 
 * @param packageName The package name to encode
 * @returns The URL-safe encoded package name
 * @throws If packageName is null or undefined
 */
export function encodePackageName(packageName: string): string {
  // Input validation
  if (packageName === null || packageName === undefined) {
    throw new Error('Package name cannot be null or undefined');
  }
  
  // Handle empty string case
  if (packageName === '') {
    return '';
  }
  
  // Check cache first for performance
  if (encodeCache.has(packageName)) {
    return encodeCache.get(packageName)!;
  }
  
  // If it looks like it's already encoded, return as is to avoid double-encoding
  if (isLikelyEncoded(packageName)) {
    return packageName;
  }
  
  // Try fast path encoding for common patterns
  const fastPath = fastPathEncode(packageName);
  if (fastPath !== null) {
    addToCache(encodeCache, packageName, fastPath);
    return fastPath;
  }
  
  let result: string;
  
  // Special handling for scoped packages to preserve structure
  if (packageName.startsWith('@') && packageName.includes('/')) {
    // Get the scope part (everything up to the first slash)
    const firstSlashIndex = packageName.indexOf('/');
    const scope = packageName.substring(0, firstSlashIndex);
    const rest = packageName.substring(firstSlashIndex + 1);
    
    // Encode scope (replacing @ with %40) and encode the rest with preserved slashes
    const encodedScope = encodeURIComponent(scope);
    let encodedRest;
    
    // If there are additional slashes in the rest, preserve them
    if (rest.includes('/')) {
      encodedRest = rest
        .split('/')
        .map(part => encodeURIComponent(part))
        .join('/');
    } else {
      encodedRest = encodeURIComponent(rest);
    }
    
    result = encodedScope + '/' + encodedRest;
  } else {
    // For regular package names, encode all characters including slashes
    result = encodeURIComponent(packageName);
  }
  
  // Cache the result for future use
  addToCache(encodeCache, packageName, result);
  return result;
}

/**
 * Decodes a URL-safe encoded package name back to its original form.
 * 
 * @param encodedPackageName The encoded package name to decode
 * @returns The original package name
 * @throws If encodedPackageName is null or undefined
 */
export function decodePackageName(encodedPackageName: string): string {
  // Input validation
  if (encodedPackageName === null || encodedPackageName === undefined) {
    throw new Error('Encoded package name cannot be null or undefined');
  }
  
  // Handle empty string case
  if (encodedPackageName === '') {
    return '';
  }
  
  // Check cache first for performance
  if (decodeCache.has(encodedPackageName)) {
    return decodeCache.get(encodedPackageName)!;
  }
  
  // If it doesn't look encoded, return as is
  if (!isLikelyEncoded(encodedPackageName)) {
    return encodedPackageName;
  }
  
  let result: string;
  
  // Special handling for scoped packages to preserve structure
  if (encodedPackageName.startsWith('%40') && encodedPackageName.includes('/')) {
    // Split by the first slash and decode each part separately
    const firstSlashIndex = encodedPackageName.indexOf('/');
    const encodedScope = encodedPackageName.substring(0, firstSlashIndex);
    const encodedRest = encodedPackageName.substring(firstSlashIndex + 1);
    
    // Decode scope (replacing %40 with @)
    const scope = decodeURIComponent(encodedScope);
    
    // If there are additional slashes in the rest, preserve them
    let rest;
    if (encodedRest.includes('/')) {
      rest = encodedRest
        .split('/')
        .map(part => decodeURIComponent(part))
        .join('/');
    } else {
      rest = decodeURIComponent(encodedRest);
    }
    
    result = scope + '/' + rest;
  } else {
    // For regular package names, decode directly
    result = decodeURIComponent(encodedPackageName);
  }
  
  // Cache the result for future use
  addToCache(decodeCache, encodedPackageName, result);
  return result;
}