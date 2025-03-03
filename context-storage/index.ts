/**
 * Zephyr URL Encoding, Remote Resolution, and Workspace Support Module
 * 
 * This module provides utilities for:
 * 1. Encoding package names for URL safety
 * 2. Resolving remote packages using the encoded names
 * 3. Working with monorepo workspaces (pnpm and yarn)
 */

// Re-export everything from url-encoding module
export { encodePackageName, decodePackageName } from './url-encoding';

// Re-export everything from remote-resolution module
export { 
  generateRemoteUrl,
  resolveRemote,
  resolveRemoteWithFallback,
  type ResolvedRemote,
  type RemoteResolutionOptions
} from './remote-resolution';

// Re-export workspace support types and functions
export {
  WorkspaceType,
  type WorkspaceConfig,
  type WorkspacePackage,
  type WorkspaceOptions,
  type VersionConflict,
  type ResolvedWorkspaceDependency
} from './workspace-types';

export {
  parsePnpmWorkspace,
  parseYarnWorkspace,
  resolveWorkspaceGlobs,
  traversePnpmWorkspacePackages,
  traverseYarnWorkspacePackages,
  traverseWorkspacePackages,
  resolveYarnWorkspaceProtocol,
  resolveWorkspaceDependency,
  resolveWorkspacePackage,
  detectVersionConflicts,
  resolveWithOverrides
} from './workspace-support';

/**
 * Package encoding, resolution, and workspace support for Zephyr
 * @module zephyr-context-storage
 */
export default {
  // URL Encoding
  encodePackageName,
  decodePackageName,
  
  // Remote Resolution
  generateRemoteUrl,
  resolveRemote,
  resolveRemoteWithFallback,
  
  // Workspace Support (exported individually to allow tree shaking)
  parsePnpmWorkspace,
  parseYarnWorkspace,
  resolveWorkspaceGlobs,
  traversePnpmWorkspacePackages,
  traverseYarnWorkspacePackages,
  traverseWorkspacePackages,
  resolveYarnWorkspaceProtocol,
  resolveWorkspaceDependency,
  resolveWorkspacePackage,
  detectVersionConflicts,
  resolveWithOverrides
};