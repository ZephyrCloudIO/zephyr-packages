/**
 * Semver Resolver for Zephyr
 * 
 * This file implements the semver resolution system for remote packages,
 * allowing version negotiation and conflict resolution.
 */

import { 
  SemverRange, 
  SemverResolutionOptions, 
  SemverResolutionResult,
  SemverResolutionError,
  SemverConflict,
  SemverRemoteConfig
} from './semver-types';

import {
  satisfiesRange,
  filterSatisfyingVersions,
  findHighestSatisfyingVersion,
  findLowestSatisfyingVersion,
  findCommonVersion,
  compareVersions
} from './semver-utils';

/**
 * Cache for resolved versions to improve performance
 */
const resolutionCache = new Map<string, SemverResolutionResult>();

/**
 * Class responsible for resolving semantic versions for remote packages
 */
export class SemverResolver {
  /**
   * Base URL for version registry API
   */
  private registryUrl: string;
  
  /**
   * Cache TTL in milliseconds
   */
  private cacheTtl: number;

  /**
   * Constructor
   * @param registryUrl Base URL for the version registry API
   * @param cacheTtl Cache time-to-live in milliseconds (default: 1 hour)
   */
  constructor(registryUrl = 'https://api.zephyr.dev/versions', cacheTtl = 3600000) {
    this.registryUrl = registryUrl;
    this.cacheTtl = cacheTtl;
  }

  /**
   * Resolves a version based on the given range and available versions
   * @param packageName Package name
   * @param range Version range requirement
   * @param options Resolution options
   * @returns Resolved version information
   */
  async resolveVersion(
    packageName: string, 
    range: SemverRange, 
    options: SemverResolutionOptions = {}
  ): Promise<SemverResolutionResult> {
    // Check cache first
    const cacheKey = `${packageName}:${range}:${JSON.stringify(options)}`;
    if (resolutionCache.has(cacheKey)) {
      return resolutionCache.get(cacheKey)!;
    }
    
    // Fetch available versions for the package
    const availableVersions = await this.fetchAvailableVersions(packageName);
    
    // Apply exclusions if provided
    const filteredVersions = options.exclude 
      ? availableVersions.filter(v => !options.exclude!.includes(v))
      : availableVersions;
    
    // Find matching versions
    const matchingVersions = filterSatisfyingVersions(
      filteredVersions, 
      range, 
      options.includePrerelease || false
    );
    
    if (matchingVersions.length === 0) {
      throw new SemverResolutionError(
        `No matching versions found for ${packageName}@${range}`,
        range,
        availableVersions
      );
    }
    
    // Determine resolution strategy
    let resolvedVersion: string;
    let exactMatch = false;
    
    // Check for exact match
    if (matchingVersions.includes(range)) {
      resolvedVersion = range;
      exactMatch = true;
    } else {
      // Apply resolution strategy
      switch (options.strategy) {
        case 'exact':
          // Exact means we need an exact version, not a range match
          throw new SemverResolutionError(
            `Exact match required but not found for ${packageName}@${range}`,
            range,
            availableVersions
          );
        case 'latest':
          // Latest means highest available version regardless of range
          resolvedVersion = availableVersions[availableVersions.length - 1];
          break;
        default:
          // Default to highest or lowest compatible version
          resolvedVersion = options.preferHighest !== false
            ? matchingVersions[matchingVersions.length - 1]
            : matchingVersions[0];
      }
    }
    
    // Construct URL for the resolved version
    const url = this.constructVersionUrl(packageName, resolvedVersion);
    
    // Create result
    const result: SemverResolutionResult = {
      resolvedVersion,
      url,
      matchingVersions,
      exactMatch
    };
    
    // Cache the result
    resolutionCache.set(cacheKey, result);
    setTimeout(() => resolutionCache.delete(cacheKey), this.cacheTtl);
    
    return result;
  }
  
  /**
   * Resolves multiple version requirements, handling conflicts
   * @param packageName Package name
   * @param ranges Multiple version range requirements
   * @param options Resolution options
   * @returns Resolution result and conflict information
   */
  async resolveConflictingVersions(
    packageName: string,
    ranges: SemverRange[],
    options: SemverResolutionOptions = {}
  ): Promise<{ result: SemverResolutionResult, conflicts: SemverConflict[] }> {
    // Fetch available versions for the package
    const availableVersions = await this.fetchAvailableVersions(packageName);
    
    // Apply exclusions if provided
    const filteredVersions = options.exclude 
      ? availableVersions.filter(v => !options.exclude!.includes(v))
      : availableVersions;
    
    // Track conflicts
    const conflicts: SemverConflict[] = [];
    
    // Find a common version that satisfies all ranges
    const commonVersion = findCommonVersion(
      ranges,
      filteredVersions,
      options.preferHighest !== false,
      options.includePrerelease || false
    );
    
    // If we found a common version, use it
    if (commonVersion) {
      const url = this.constructVersionUrl(packageName, commonVersion);
      const matchingVersions = filterSatisfyingVersions(
        filteredVersions,
        ranges[0],
        options.includePrerelease || false
      );
      
      // Check if there were any conflicts, even though we found a resolution
      if (ranges.length > 1) {
        for (let i = 0; i < ranges.length; i++) {
          for (let j = i + 1; j < ranges.length; j++) {
            const matchingI = filterSatisfyingVersions(
              filteredVersions,
              ranges[i],
              options.includePrerelease || false
            );
            
            const matchingJ = filterSatisfyingVersions(
              filteredVersions,
              ranges[j],
              options.includePrerelease || false
            );
            
            // If there are versions unique to each range, there's a potential conflict
            const onlyInI = matchingI.filter(v => !matchingJ.includes(v));
            const onlyInJ = matchingJ.filter(v => !matchingI.includes(v));
            
            if (onlyInI.length > 0 || onlyInJ.length > 0) {
              conflicts.push({
                range1: ranges[i],
                range2: ranges[j],
                moduleName: packageName,
                resolved: true,
                resolutionStrategy: options.preferHighest !== false ? 'highest' : 'lowest',
                resolvedVersion: commonVersion
              });
            }
          }
        }
      }
      
      return {
        result: {
          resolvedVersion: commonVersion,
          url,
          matchingVersions,
          exactMatch: ranges.includes(commonVersion)
        },
        conflicts
      };
    }
    
    // No common version - we have a real conflict
    // In this case, we'll follow the resolution strategy to pick a version
    
    // First, record all conflicts
    for (let i = 0; i < ranges.length; i++) {
      for (let j = i + 1; j < ranges.length; j++) {
        conflicts.push({
          range1: ranges[i],
          range2: ranges[j],
          moduleName: packageName,
          resolved: false
        });
      }
    }
    
    // Now try to resolve based on strategy
    let resolvedVersion: string;
    let resolutionStrategy: 'highest' | 'lowest' | 'manual' | 'none';
    
    switch (options.strategy) {
      case 'latest':
        // Take the highest available version
        resolvedVersion = availableVersions[availableVersions.length - 1];
        resolutionStrategy = 'highest';
        break;
      case 'exact':
        // Exact requires a shared version, which we don't have
        throw new SemverResolutionError(
          `No version satisfies all requirements for ${packageName}: ${ranges.join(', ')}`,
          ranges.join(' && '),
          availableVersions
        );
      default:
        // Default strategy: take the highest matching version from the first range
        const matchingFirstRange = filterSatisfyingVersions(
          filteredVersions,
          ranges[0],
          options.includePrerelease || false
        );
        
        if (matchingFirstRange.length === 0) {
          throw new SemverResolutionError(
            `No matching versions found for ${packageName}@${ranges[0]}`,
            ranges[0],
            availableVersions
          );
        }
        
        resolvedVersion = options.preferHighest !== false
          ? matchingFirstRange[matchingFirstRange.length - 1]
          : matchingFirstRange[0];
        
        resolutionStrategy = options.preferHighest !== false ? 'highest' : 'lowest';
    }
    
    // Update conflicts with resolution info
    conflicts.forEach(conflict => {
      conflict.resolved = true;
      conflict.resolutionStrategy = resolutionStrategy;
      conflict.resolvedVersion = resolvedVersion;
    });
    
    const url = this.constructVersionUrl(packageName, resolvedVersion);
    
    return {
      result: {
        resolvedVersion,
        url,
        matchingVersions: [resolvedVersion], // Only the resolved version truly matches all requirements
        exactMatch: false
      },
      conflicts
    };
  }

  /**
   * Resolves multiple remote configurations
   * @param remotes Map of remote configurations
   * @returns Map of resolved remote URLs
   */
  async resolveRemotes(
    remotes: Record<string, SemverRemoteConfig>,
    options: SemverResolutionOptions = {}
  ): Promise<Record<string, string>> {
    const resolved: Record<string, string> = {};
    const conflicts: SemverConflict[] = [];
    
    // Group remotes by package name to detect conflicts
    const remotesByPackage = new Map<string, { name: string, config: SemverRemoteConfig }[]>();
    
    // First pass: group by package
    for (const [name, config] of Object.entries(remotes)) {
      const packageName = config.remote;
      
      if (!remotesByPackage.has(packageName)) {
        remotesByPackage.set(packageName, []);
      }
      
      remotesByPackage.get(packageName)!.push({ name, config });
    }
    
    // Second pass: resolve each package, handling conflicts
    for (const [packageName, remoteConfigs] of remotesByPackage.entries()) {
      // If there's only one config for this package, simple resolution
      if (remoteConfigs.length === 1) {
        const { name, config } = remoteConfigs[0];
        
        // If no version specified, use latest
        if (!config.version) {
          const availableVersions = await this.fetchAvailableVersions(packageName);
          const latestVersion = availableVersions[availableVersions.length - 1];
          resolved[name] = this.constructVersionUrl(packageName, latestVersion);
          continue;
        }
        
        // Resolve with version
        const resolution = await this.resolveVersion(
          packageName,
          config.version,
          { ...options, ...config.options }
        );
        
        resolved[name] = resolution.url;
      } else {
        // Multiple configs for the same package - possible conflict
        const ranges = remoteConfigs
          .map(r => r.config.version)
          .filter((v): v is string => !!v); // Filter out undefined versions
        
        // If all configs don't specify version, use latest
        if (ranges.length === 0) {
          const availableVersions = await this.fetchAvailableVersions(packageName);
          const latestVersion = availableVersions[availableVersions.length - 1];
          const url = this.constructVersionUrl(packageName, latestVersion);
          
          // Set the same URL for all remotes of this package
          remoteConfigs.forEach(r => {
            resolved[r.name] = url;
          });
          
          continue;
        }
        
        // Resolve conflicts
        const { result, conflicts: newConflicts } = await this.resolveConflictingVersions(
          packageName,
          ranges,
          { ...options, ...remoteConfigs[0].config.options }
        );
        
        // Add conflicts to our list
        conflicts.push(...newConflicts);
        
        // Set the resolved URL for all remotes of this package
        remoteConfigs.forEach(r => {
          resolved[r.name] = result.url;
        });
      }
    }
    
    // Log conflicts for debugging
    if (conflicts.length > 0) {
      console.warn(`Resolved ${conflicts.length} version conflicts:`, conflicts);
    }
    
    return resolved;
  }

  /**
   * Fetches available versions for a package
   * @param packageName Package name
   * @returns Array of available versions
   */
  private async fetchAvailableVersions(packageName: string): Promise<string[]> {
    // In a real implementation, this would call the registry API
    // For now, we'll mock some versions for demonstration
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Return mock versions
    return [
      '0.1.0', '0.1.1', '0.2.0',
      '1.0.0-alpha.1', '1.0.0-beta.1', '1.0.0-beta.2', '1.0.0-rc.1',
      '1.0.0', '1.0.1', '1.0.2',
      '1.1.0', '1.2.0', '1.3.0',
      '2.0.0-alpha.1', '2.0.0-beta.1',
      '2.0.0', '2.1.0', '2.2.0',
      '3.0.0', '3.1.0'
    ].sort((a, b) => compareVersions(a, b));
  }

  /**
   * Constructs a URL for a specific package version
   * @param packageName Package name
   * @param version Version
   * @returns URL for the package version
   */
  private constructVersionUrl(packageName: string, version: string): string {
    // In a real implementation, this would construct the URL based on your system's conventions
    return `${this.registryUrl}/${packageName}/${version}/remoteEntry.js`;
  }

  /**
   * Clears the resolution cache
   */
  clearCache(): void {
    resolutionCache.clear();
  }
}