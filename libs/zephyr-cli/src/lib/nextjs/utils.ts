/** Helper utilities for Next.js deployment */

import * as fs from 'fs';
import * as path from 'path';
import { ZephyrError, ZeErrors } from 'zephyr-agent';

/**
 * Find the .next directory in the given project directory
 *
 * @param projectDir - Root directory of Next.js project
 * @returns Absolute path to .next directory
 * @throws {ZephyrError} If .next directory not found
 */
export function findNextDir(projectDir: string): string {
  const nextDir = path.join(projectDir, '.next');

  if (!fs.existsSync(nextDir)) {
    throw new ZephyrError(ZeErrors.ERR_UNKNOWN, {
      message:
        `Next.js build directory not found at: ${nextDir}\n` +
        `Please run 'next build' first to generate the build output.`,
    });
  }

  if (!fs.statSync(nextDir).isDirectory()) {
    throw new ZephyrError(ZeErrors.ERR_UNKNOWN, {
      message: `.next exists but is not a directory: ${nextDir}`,
    });
  }

  return nextDir;
}

/**
 * Validate that the Next.js build is complete and has required files
 *
 * @param nextDir - Path to .next directory
 * @throws {ZephyrError} If build is incomplete or invalid
 */
export function validateNextBuild(nextDir: string): void {
  // Check for required files
  const requiredFiles = [
    'BUILD_ID',
    'routes-manifest.json',
    'required-server-files.json',
  ];

  const missingFiles: string[] = [];

  for (const file of requiredFiles) {
    const filePath = path.join(nextDir, file);
    if (!fs.existsSync(filePath)) {
      missingFiles.push(file);
    }
  }

  if (missingFiles.length > 0) {
    throw new ZephyrError(ZeErrors.ERR_UNKNOWN, {
      message:
        `Invalid or incomplete Next.js build. Missing required files:\n` +
        missingFiles.map((f) => `  - ${f}`).join('\n') +
        `\n\nPlease run 'next build' to generate a complete build.`,
    });
  }

  // Check for server directory
  const serverDir = path.join(nextDir, 'server');
  if (!fs.existsSync(serverDir) || !fs.statSync(serverDir).isDirectory()) {
    throw new ZephyrError(ZeErrors.ERR_UNKNOWN, {
      message:
        `Next.js build is missing 'server' directory at: ${serverDir}\n` +
        `This suggests an incomplete or corrupted build.`,
    });
  }

  // Check for static directory (for App Router builds)
  const staticDir = path.join(nextDir, 'static');
  if (!fs.existsSync(staticDir) || !fs.statSync(staticDir).isDirectory()) {
    console.error(
      '[ze-cli] Warning: No static directory found. This may be normal for server-only builds.'
    );
  }
}

/**
 * Read the BUILD_ID from the .next directory
 *
 * @param nextDir - Path to .next directory
 * @returns Build ID string
 * @throws {ZephyrError} If BUILD_ID file cannot be read
 */
export function getBuildId(nextDir: string): string {
  const buildIdPath = path.join(nextDir, 'BUILD_ID');

  try {
    const buildId = fs.readFileSync(buildIdPath, 'utf-8').trim();
    if (!buildId) {
      throw new Error('BUILD_ID file is empty');
    }
    return buildId;
  } catch (error) {
    throw new ZephyrError(ZeErrors.ERR_UNKNOWN, {
      message: `Failed to read BUILD_ID: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }
}

/**
 * Resolve a path relative to a base directory Handles both relative and absolute paths,
 * including monorepo traversal
 *
 * @param basePath - Base directory to resolve from
 * @param relativePath - Path to resolve (may start with ../)
 * @returns Absolute resolved path
 */
export function resolvePath(basePath: string, relativePath: string): string {
  if (path.isAbsolute(relativePath)) {
    return relativePath;
  }
  return path.resolve(basePath, relativePath);
}

/**
 * Check if a file or directory exists
 *
 * @param filePath - Path to check
 * @returns True if exists, false otherwise
 */
export function fileExists(filePath: string): boolean {
  try {
    fs.accessSync(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read a JSON file and parse it
 *
 * @param filePath - Path to JSON file
 * @returns Parsed JSON object
 * @throws {ZephyrError} If file cannot be read or parsed
 */
export function readJsonFile<T = any>(filePath: string): T {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch (error) {
    throw new ZephyrError(ZeErrors.ERR_UNKNOWN, {
      message: `Failed to read JSON file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }
}

/**
 * Recursively create directory if it doesn't exist
 *
 * @param dirPath - Directory path to create
 */
export function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Copy a file from source to destination
 *
 * @param src - Source file path
 * @param dest - Destination file path
 */
export function copyFile(src: string, dest: string): void {
  // Ensure destination directory exists
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

/**
 * Get relative path from one absolute path to another
 *
 * @param from - From path (absolute)
 * @param to - To path (absolute)
 * @returns Relative path
 */
export function getRelativePath(from: string, to: string): string {
  return path.relative(from, to);
}

/**
 * Normalize path separators to forward slashes (for consistency)
 *
 * @param filePath - Path to normalize
 * @returns Normalized path with forward slashes
 */
export function normalizePath(filePath: string): string {
  return filePath.split(path.sep).join('/');
}

/**
 * Check if a path is inside another path
 *
 * @param child - Child path to check
 * @param parent - Parent path
 * @returns True if child is inside parent
 */
export function isPathInside(child: string, parent: string): boolean {
  const rel = path.relative(parent, child);
  return !rel.startsWith('..') && !path.isAbsolute(rel);
}

/**
 * Get all files in a directory recursively
 *
 * @param dir - Directory to scan
 * @param fileList - Accumulated file list (used for recursion)
 * @returns Array of absolute file paths
 */
export function getFilesRecursively(dir: string, fileList: string[] = []): string[] {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      getFilesRecursively(filePath, fileList);
    } else {
      fileList.push(filePath);
    }
  }

  return fileList;
}

/**
 * Format bytes to human-readable size
 *
 * @param bytes - Number of bytes
 * @returns Formatted string (e.g., "1.5 MB")
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Check if a route path is dynamic (contains [...])
 *
 * @param routePath - Route path to check
 * @returns True if route is dynamic
 */
export function isDynamicRoute(routePath: string): boolean {
  return routePath.includes('[') && routePath.includes(']');
}

/**
 * Get the output file tracing root from required-server-files.json This is important for
 * monorepo setups where .nft.json paths reference parent directories
 *
 * @param nextDir - Path to .next directory
 * @returns Absolute path to tracing root, or nextDir parent if not specified
 */
export function getOutputFileTracingRoot(nextDir: string, config: any): string {
  if (config?.outputFileTracingRoot) {
    // If absolute, use as-is
    if (path.isAbsolute(config.outputFileTracingRoot)) {
      return config.outputFileTracingRoot;
    }
    // If relative, resolve from next.config location (parent of .next)
    const projectDir = path.dirname(nextDir);
    return path.resolve(projectDir, config.outputFileTracingRoot);
  }

  // Default: use parent of .next directory (project root)
  return path.dirname(nextDir);
}
