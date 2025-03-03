/**
 * Enhanced Remote Resolution with Semver Support
 * 
 * This file enhances the remote resolution system with semver support,
 * allowing for version-aware remote resolution.
 */

import { encodePackageName, decodePackageName } from './url-encoding';
import { SemverResolver } from './semver-resolver';
import { SemverRemoteConfig, SemverResolutionOptions } from './semver-types';

/**
 * Interface for remote configurations supporting semver
 */
export interface RemoteConfig {
  /**
   * The remote URL or name
   */
  remote: string;
  
  /**
   * Optional version requirement (e.g., "^1.0.0", "~2.0.0")
   */
  version?: string;
  
  /**
   * Optional semver resolution options
   */
  options?: SemverResolutionOptions;
  
  /**
   * Optional array of fallback URLs
   */
  fallbacks?: string[];
}

/**
 * Configuration for remote resolution
 */
export interface RemoteResolutionConfig {
  /**
   * Registry URL for version resolution
   */
  registryUrl?: string;
  
  /**
   * Default semver resolution options
   */
  defaultOptions?: SemverResolutionOptions;
  
  /**
   * Cache TTL in milliseconds
   */
  cacheTtl?: number;
  
  /**
   * Whether to encode package names in URLs
   */
  encodeUrls?: boolean;
}

/**
 * Enhanced remote resolution service with semver support
 */
export class EnhancedRemoteResolver {
  private semverResolver: SemverResolver;
  private encodeUrls: boolean;
  private defaultOptions: SemverResolutionOptions;
  
  /**
   * Constructor
   * @param config Configuration options
   */
  constructor(config: RemoteResolutionConfig = {}) {
    this.semverResolver = new SemverResolver(
      config.registryUrl,
      config.cacheTtl
    );
    this.encodeUrls = config.encodeUrls !== false;
    this.defaultOptions = config.defaultOptions || {};
  }
  
  /**
   * Resolves remote configurations with semver support
   * @param remotes Map of remote configurations
   * @param options Global resolution options
   * @returns Map of resolved remote URLs
   */
  async resolveRemotes(
    remotes: Record<string, string | RemoteConfig>,
    options: SemverResolutionOptions = {}
  ): Promise<Record<string, string>> {
    // Convert string remotes to RemoteConfig objects
    const normalizedRemotes: Record<string, SemverRemoteConfig> = {};
    
    for (const [name, config] of Object.entries(remotes)) {
      if (typeof config === 'string') {
        // Simple URL/string remote
        normalizedRemotes[name] = { remote: config };
      } else {
        // Full remote configuration
        normalizedRemotes[name] = {
          remote: config.remote,
          version: config.version,
          options: config.options
        };
      }
    }
    
    // Merge options
    const mergedOptions = { ...this.defaultOptions, ...options };
    
    // Resolve with semver support
    const resolvedUrls = await this.semverResolver.resolveRemotes(
      normalizedRemotes,
      mergedOptions
    );
    
    // Encode URLs if needed
    if (this.encodeUrls) {
      const encoded: Record<string, string> = {};
      
      for (const [name, url] of Object.entries(resolvedUrls)) {
        // Parse URL to extract package name for encoding
        try {
          const parsedUrl = new URL(url);
          const path = parsedUrl.pathname.split('/');
          
          // Assume package name is the first path segment after the registry path
          // This might need to be adjusted based on actual URL structure
          if (path.length >= 3) {
            const packageName = decodeURIComponent(path[1]);
            const encodedName = encodePackageName(packageName);
            
            // Replace the package name in the URL
            path[1] = encodedName;
            parsedUrl.pathname = path.join('/');
            encoded[name] = parsedUrl.toString();
          } else {
            // Can't parse properly, just use the original
            encoded[name] = url;
          }
        } catch (e) {
          // Not a valid URL, just use the original
          encoded[name] = url;
        }
      }
      
      return encoded;
    }
    
    return resolvedUrls;
  }
  
  /**
   * Clears the resolution cache
   */
  clearCache(): void {
    this.semverResolver.clearCache();
  }
}

/**
 * Creates an enhanced remote resolver with the given configuration
 * @param config Configuration options
 * @returns Enhanced remote resolver instance
 */
export function createEnhancedRemoteResolver(
  config: RemoteResolutionConfig = {}
): EnhancedRemoteResolver {
  return new EnhancedRemoteResolver(config);
}