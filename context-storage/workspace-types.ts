/**
 * Workspace Support Types - Phase 2.2
 * 
 * This module defines the interfaces and types for workspace support functionality.
 */

/**
 * Enum representing the type of workspace
 */
export enum WorkspaceType {
  PNPM = 'pnpm',
  YARN = 'yarn',
  NPM = 'npm'
}

/**
 * Interface representing a workspace configuration
 */
export interface WorkspaceConfig {
  /** The type of workspace */
  type: WorkspaceType;
  
  /** The root directory of the workspace */
  root: string;
  
  /** Glob patterns for included packages */
  patterns: string[];
  
  /** Glob patterns for excluded packages */
  excludes: string[];
  
  /** Overrides for dependency versions (from resolutions field) */
  overrides?: Record<string, string>;
}

/**
 * Interface representing a workspace package
 */
export interface WorkspacePackage {
  /** The name of the package */
  name: string;
  
  /** The absolute file path to the package */
  path: string;
  
  /** The version of the package */
  version: string;
  
  /** Whether the package is marked as private */
  private?: boolean;
  
  /** Regular dependencies */
  dependencies?: Record<string, string>;
  
  /** Development dependencies */
  devDependencies?: Record<string, string>;
  
  /** Peer dependencies */
  peerDependencies?: Record<string, string>;
  
  /** Flag indicating if this is a workspace dependency */
  isWorkspaceDependency?: boolean;
}

/**
 * Interface representing a version conflict
 */
export interface VersionConflict {
  /** The name of the package with conflicts */
  package: string;
  
  /** The versions required by different packages */
  versions: Array<{
    /** The required version */
    version: string;
    
    /** The packages requiring this version */
    requiredBy: string[];
  }>;
}

/**
 * Options for workspace processing
 */
export interface WorkspaceOptions {
  /** Whether to include private packages */
  includePrivate?: boolean;
  
  /** Whether to include development dependencies */
  includeDev?: boolean;
  
  /** Whether to include peer dependencies */
  includePeer?: boolean;
  
  /** Custom overrides for dependency versions */
  overrides?: Record<string, string>;
}

/**
 * Interface for a resolved workspace dependency
 */
export interface ResolvedWorkspaceDependency {
  /** The name of the dependency */
  name: string;
  
  /** The resolved version */
  version: string;
  
  /** The path to the dependency */
  path: string;
  
  /** Whether this was resolved from the workspace */
  fromWorkspace: boolean;
}