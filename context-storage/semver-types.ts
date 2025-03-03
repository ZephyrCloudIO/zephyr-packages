/**
 * Semver Types and Interfaces for Zephyr
 * 
 * This file defines TypeScript types and interfaces for semantic versioning support
 * in Zephyr's remote resolution system.
 */

export type SemverRange = string;

/**
 * Represents a fully qualified version (e.g., "1.2.3")
 */
export interface SemverVersion {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
  buildMetadata?: string;
}

/**
 * Configuration for a remote with semver support
 */
export interface SemverRemoteConfig {
  /** 
   * The base URL or name of the remote 
   */
  remote: string;
  
  /** 
   * Version requirement (e.g., "^1.0.0", "~2.0.0", ">=1.0.0 <2.0.0") 
   */
  version?: SemverRange;
  
  /**
   * Additional options for version resolution
   */
  options?: SemverResolutionOptions;
}

/**
 * Options for controlling semver resolution behavior
 */
export interface SemverResolutionOptions {
  /**
   * If true, use the highest compatible version; if false, use the lowest
   */
  preferHighest?: boolean;
  
  /**
   * If true, consider prerelease versions; if false, ignore them
   */
  includePrerelease?: boolean;
  
  /**
   * Custom version resolution strategy
   */
  strategy?: 'exact' | 'compatible' | 'latest';
  
  /**
   * List of specific versions to exclude
   */
  exclude?: string[];
}

/**
 * Result of a semver resolution operation
 */
export interface SemverResolutionResult {
  /**
   * The resolved version that matches the requirements
   */
  resolvedVersion: string;
  
  /**
   * The URL for the resolved version
   */
  url: string;
  
  /**
   * All versions that matched the requirements (sorted)
   */
  matchingVersions: string[];
  
  /**
   * Whether an exact match was found
   */
  exactMatch: boolean;
}

/**
 * Error thrown when version resolution fails
 */
export class SemverResolutionError extends Error {
  constructor(
    message: string,
    public readonly versionRequirement: SemverRange,
    public readonly availableVersions: string[]
  ) {
    super(message);
    this.name = 'SemverResolutionError';
  }
}

/**
 * Represents a conflict between two version ranges
 */
export interface SemverConflict {
  /**
   * The first version range
   */
  range1: SemverRange;
  
  /**
   * The second version range
   */
  range2: SemverRange;
  
  /**
   * The module or package name
   */
  moduleName: string;
  
  /**
   * Whether a resolution was found despite the conflict
   */
  resolved: boolean;
  
  /**
   * The resolution strategy used
   */
  resolutionStrategy?: 'highest' | 'lowest' | 'manual' | 'none';
  
  /**
   * The resolved version, if any
   */
  resolvedVersion?: string;
}