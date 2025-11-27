/** Utilities for bundling Next.js serverless functions with dependencies */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ZephyrError, ZeErrors, logFn } from 'zephyr-agent';
import { NftFile, RouteInfo, ServerlessFunction, NextJsManifests } from './types';
import {
  readJsonFile,
  fileExists,
  resolvePath,
  copyFile,
  ensureDir,
  normalizePath,
  getOutputFileTracingRoot,
  formatBytes,
} from './utils';

/**
 * Parse a .nft.json file
 *
 * @param nftPath - Path to .nft.json file
 * @returns Parsed NFT file contents
 */
export function parseNftFile(nftPath: string): NftFile {
  if (!fileExists(nftPath)) {
    throw new ZephyrError(ZeErrors.ERR_UNKNOWN, {
      message: `NFT file not found: ${nftPath}`,
    });
  }

  return readJsonFile<NftFile>(nftPath);
}

/**
 * Resolve all file paths from a .nft.json file to absolute paths
 *
 * @param nftPath - Path to .nft.json file
 * @param nftData - Parsed NFT file data
 * @param tracingRoot - Output file tracing root (for monorepos)
 * @returns Array of absolute file paths
 */
export function resolveNftPaths(
  nftPath: string,
  nftData: NftFile,
  tracingRoot: string
): string[] {
  const nftDir = path.dirname(nftPath);
  const resolvedPaths: string[] = [];

  for (const relPath of nftData.files) {
    // Resolve relative to the .nft.json file location
    let absPath = resolvePath(nftDir, relPath);

    // If path doesn't exist, try resolving from tracing root
    // This handles monorepo cases where paths go up beyond project root
    if (!fileExists(absPath)) {
      absPath = resolvePath(tracingRoot, relPath);
    }

    // Verify file exists
    if (!fileExists(absPath)) {
      console.error(
        `[ze-cli] Warning: NFT dependency not found: ${relPath} (resolved to ${absPath})`
      );
      continue;
    }

    resolvedPaths.push(absPath);
  }

  return resolvedPaths;
}

/**
 * Bundle a serverless function with all its dependencies
 *
 * @param nextDir - Path to .next directory
 * @param route - Route information
 * @param manifests - Parsed Next.js manifests
 * @param verbose - Verbose logging
 * @returns Bundled serverless function
 */
export function bundleServerlessFunction(
  nextDir: string,
  route: RouteInfo,
  manifests: NextJsManifests,
  verbose: boolean = false
): ServerlessFunction {
  if (!route.entryPoint) {
    throw new ZephyrError(ZeErrors.ERR_UNKNOWN, {
      message: `Cannot bundle route without entry point: ${route.path}`,
    });
  }

  const serverDir = path.join(nextDir, 'server');
  const entryPointPath = path.join(serverDir, route.entryPoint);

  // Edge functions don't use NFT files - they're already bundled by Next.js
  if (route.runtime === 'edge') {
    return bundleEdgeFunction(nextDir, route, manifests, verbose);
  }

  // Check if .nft.json exists for this entry point
  const nftPath = `${entryPointPath}.nft.json`;
  if (!fileExists(nftPath)) {
    throw new ZephyrError(ZeErrors.ERR_UNKNOWN, {
      message:
        `NFT file not found for route ${route.path}: ${nftPath}\n` +
        `This suggests the Next.js build is incomplete or corrupted.`,
    });
  }

  // Parse .nft.json
  const nftData = parseNftFile(nftPath);

  // Get tracing root for path resolution
  const tracingRoot = getOutputFileTracingRoot(
    nextDir,
    manifests.requiredServerFiles.config
  );

  // Resolve all dependency paths
  const dependencies = resolveNftPaths(nftPath, nftData, tracingRoot);

  // Add the entry point itself
  dependencies.unshift(entryPointPath);

  // Create temp directory for bundle
  const bundleDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ze-nextjs-'));

  if (verbose) {
    logFn('info', `Bundling function for route: ${route.path}`);
    logFn('info', `  Entry point: ${route.entryPoint}`);
    logFn('info', `  Dependencies: ${dependencies.length} files`);
  }

  // Copy all files to bundle directory
  let totalSize = 0;
  for (const srcPath of dependencies) {
    // Determine relative path within bundle
    // For files in .next/server, preserve structure
    // For files outside (node_modules, etc), preserve full structure from tracing root
    let destRelPath: string;

    if (srcPath.startsWith(serverDir)) {
      // Server file - preserve structure relative to server dir
      destRelPath = path.relative(serverDir, srcPath);
    } else if (srcPath.startsWith(nextDir)) {
      // Other .next file - preserve structure relative to .next
      destRelPath = path.relative(nextDir, srcPath);
    } else {
      // External file (e.g., node_modules) - preserve structure from tracing root
      destRelPath = path.relative(tracingRoot, srcPath);
    }

    const destPath = path.join(bundleDir, destRelPath);

    try {
      copyFile(srcPath, destPath);
      const stat = fs.statSync(srcPath);
      totalSize += stat.size;
    } catch (error) {
      console.error(
        `[ze-cli] Warning: Failed to copy file ${srcPath}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // Copy required manifests and config files
  copyRequiredManifests(nextDir, bundleDir, route, verbose);

  if (verbose) {
    logFn('info', `  Bundle size: ${formatBytes(totalSize)}`);
    logFn('info', `  Bundle location: ${bundleDir}`);
  }

  return {
    route: route.path,
    entryPoint: route.entryPoint,
    dependencies,
    runtime: route.runtime,
    bundleDir,
    regex: route.regex,
    isDynamic: route.isDynamic,
    routeKeys: route.routeKeys,
  };
}

/**
 * Bundle an edge function (which is already bundled by Next.js)
 *
 * @param nextDir - Path to .next directory
 * @param route - Route information
 * @param manifests - Parsed Next.js manifests
 * @param verbose - Verbose logging
 * @returns Bundled edge function
 */
function bundleEdgeFunction(
  nextDir: string,
  route: RouteInfo,
  manifests: NextJsManifests,
  verbose: boolean = false
): ServerlessFunction {
  const serverDir = path.join(nextDir, 'server');
  const entryPointPath = path.join(serverDir, route.entryPoint!);

  if (verbose) {
    logFn('debug', `Bundling edge function: ${route.path}`);
    logFn('debug', `  Entry point: ${route.entryPoint}`);
  }

  // Verify entry point exists
  if (!fileExists(entryPointPath)) {
    throw new ZephyrError(ZeErrors.ERR_UNKNOWN, {
      message: `Edge function entry point not found: ${entryPointPath}`,
    });
  }

  // Create a temporary bundle directory
  const bundleDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zephyr-edge-'));

  // Get all files from middleware-manifest.json
  const edgeFuncInfo = Object.values(manifests.middleware?.functions || {}).find(
    (func) => func.matchers?.some((m) => m.originalSource === route.path)
  );

  const filesToCopy: string[] = [];
  const edgeChunkFiles: string[] = []; // Track edge chunk files separately

  if (edgeFuncInfo && edgeFuncInfo.files) {
    // Copy all files listed in the middleware manifest
    // These files must be loaded in order for Turbopack to work correctly
    for (const file of edgeFuncInfo.files) {
      const srcPath = path.join(nextDir, file);
      if (fileExists(srcPath)) {
        // For edge functions, we need to preserve the full path structure
        // so that imports work correctly in the worker
        // Files are like: server/edge/chunks/xxx.js
        // We want to keep them as: edge/chunks/xxx.js
        const normalizedFile = file.startsWith('server/') ? file.slice(7) : file;
        const destPath = path.join(bundleDir, normalizedFile);
        copyFile(srcPath, destPath);
        filesToCopy.push(normalizedFile);

        // Track if this is an edge chunk file
        if (normalizedFile.startsWith('edge/chunks/')) {
          edgeChunkFiles.push(normalizedFile);
        }

        if (verbose) {
          logFn('debug', `  Copied: ${file} -> ${normalizedFile}`);
        }
      }
    }

    if (verbose && edgeChunkFiles.length > 0) {
      logFn('debug', `  Edge chunks: ${edgeChunkFiles.join(', ')}`);
    }
  } else {
    // Fallback: just copy the entry point
    const destEntryPoint = path.join(bundleDir, route.entryPoint!);
    copyFile(entryPointPath, destEntryPoint);
    filesToCopy.push(route.entryPoint!);
  }

  // Copy required manifests
  copyRequiredManifests(nextDir, bundleDir, route, verbose);

  if (verbose) {
    logFn('debug', `✓ Bundled edge function: ${route.path} (${filesToCopy.length} files)`);
  }

  return {
    route: route.path,
    entryPoint: route.entryPoint!,
    dependencies: filesToCopy, // List all the edge function files
    runtime: route.runtime,
    bundleDir,
    regex: route.regex,
    isDynamic: route.isDynamic,
    routeKeys: route.routeKeys,
    // Store edge chunk files for the worker to load in order
    edgeChunkFiles,
  };
}

/**
 * Copy required manifest files to bundle directory These manifests are needed by Next.js
 * runtime to function properly
 *
 * @param nextDir - Path to .next directory
 * @param bundleDir - Bundle directory
 * @param route - Route information
 * @param verbose - Verbose logging
 */
function copyRequiredManifests(
  nextDir: string,
  bundleDir: string,
  route: RouteInfo,
  verbose: boolean
): void {
  // Required manifest files that Next.js needs at runtime
  const manifestFiles = [
    'required-server-files.json',
    'routes-manifest.json',
    'prerender-manifest.json',
    'BUILD_ID',
  ];

  // Additional manifests in server directory
  const serverManifests = [
    'server/pages-manifest.json',
    'server/app-paths-manifest.json',
    'server/middleware-manifest.json',
    'server/functions-config-manifest.json',
  ];

  // Copy root-level manifests
  for (const file of manifestFiles) {
    const srcPath = path.join(nextDir, file);
    if (fileExists(srcPath)) {
      const destPath = path.join(bundleDir, file);
      copyFile(srcPath, destPath);
      if (verbose) {
        logFn('debug', `  Copied manifest: ${file}`);
      }
    }
  }

  // Copy server manifests
  for (const file of serverManifests) {
    const srcPath = path.join(nextDir, file);
    if (fileExists(srcPath)) {
      const destPath = path.join(bundleDir, file);
      copyFile(srcPath, destPath);
      if (verbose) {
        logFn('debug', `  Copied manifest: ${file}`);
      }
    }
  }

  // Copy route-specific manifests (for App Router)
  if (route.entryPoint && route.entryPoint.startsWith('app/')) {
    const routeDir = path.dirname(route.entryPoint);
    const routeManifestDir = path.join(nextDir, 'server', routeDir);

    // Look for route-specific manifests
    const routeManifests = [
      'build-manifest.json',
      'app-paths-manifest.json',
      'server-reference-manifest.json',
      'next-font-manifest.json',
      'react-loadable-manifest.json',
    ];

    for (const file of routeManifests) {
      const srcPath = path.join(routeManifestDir, file);
      if (fileExists(srcPath)) {
        const destPath = path.join(bundleDir, 'server', routeDir, file);
        copyFile(srcPath, destPath);
        if (verbose) {
          logFn('debug', `  Copied route manifest: ${file}`);
        }
      }
    }
  }
}

/**
 * Bundle all serverless routes
 *
 * @param nextDir - Path to .next directory
 * @param routes - Array of routes to bundle
 * @param manifests - Parsed Next.js manifests
 * @param verbose - Verbose logging
 * @returns Array of bundled serverless functions
 */
export function bundleAllServerlessRoutes(
  nextDir: string,
  routes: RouteInfo[],
  manifests: NextJsManifests,
  verbose: boolean = false
): ServerlessFunction[] {
  const functions: ServerlessFunction[] = [];

  logFn('info', `Bundling ${routes.length} serverless routes...`);

  for (const route of routes) {
    try {
      const func = bundleServerlessFunction(nextDir, route, manifests, verbose);
      functions.push(func);
    } catch (error) {
      console.error(
        `[ze-cli] Error bundling route ${route.path}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      // Continue with other routes
    }
  }

  logFn('info', `Successfully bundled ${functions.length} functions`);

  return functions;
}

/**
 * Clean up temporary bundle directories
 *
 * @param functions - Array of serverless functions
 */
export function cleanupBundles(functions: ServerlessFunction[]): void {
  for (const func of functions) {
    try {
      if (fs.existsSync(func.bundleDir)) {
        fs.rmSync(func.bundleDir, { recursive: true, force: true });
      }
    } catch (error) {
      console.error(
        `[ze-cli] Warning: Failed to cleanup bundle directory ${func.bundleDir}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}

/**
 * Get total size of all bundled functions
 *
 * @param functions - Array of serverless functions
 * @returns Total size in bytes
 */
export function getTotalBundleSize(functions: ServerlessFunction[]): number {
  let totalSize = 0;

  for (const func of functions) {
    try {
      const files = getAllFilesInDir(func.bundleDir);
      for (const file of files) {
        const stat = fs.statSync(file);
        totalSize += stat.size;
      }
    } catch (error) {
      console.error(`[ze-cli] Warning: Failed to calculate size for ${func.bundleDir}`);
    }
  }

  return totalSize;
}

/**
 * Get all files in a directory recursively
 *
 * @param dir - Directory path
 * @returns Array of file paths
 */
function getAllFilesInDir(dir: string): string[] {
  const files: string[] = [];

  function walk(currentDir: string): void {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        walk(fullPath);
      } else {
        files.push(fullPath);
      }
    }
  }

  walk(dir);
  return files;
}
