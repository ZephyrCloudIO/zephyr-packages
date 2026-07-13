import { sep } from 'node:path';
import {
  buildAssetsMap,
  logFn,
  readDirRecursiveWithContents,
  type ZeBuildAssetsMap,
} from 'zephyr-agent';
import type { ZephyrBuildTarget } from 'zephyr-edge-contract';

interface DirectoryAsset {
  content: Buffer | string;
  type: string;
}

export interface ExtractAssetsFromDirectoryOptions {
  /** TAP packages publish their complete SDK-locked output without web-app filters. */
  target?: ZephyrBuildTarget;
}

function extractBuffer(asset: DirectoryAsset): Buffer | string | undefined {
  return asset.content;
}

function getAssetType(asset: DirectoryAsset): string {
  return asset.type;
}

/** Normalize path separators to forward slashes for cross-platform consistency */
function normalizePath(filePath: string): string {
  return filePath.split(sep).join('/');
}

/**
 * Extract assets map from a directory by recursively walking through it. Similar to
 * extractAstroAssetsMap but for any directory.
 */
export async function extractAssetsFromDirectory(
  buildDir: string,
  options: ExtractAssetsFromDirectoryOptions = {}
): Promise<ZeBuildAssetsMap> {
  const assets: Record<string, DirectoryAsset> = {};

  try {
    const preservesLockedArtifacts = options.target === 'tap-app';
    const files = await readDirRecursiveWithContents(buildDir, {
      includeIgnoredPaths: preservesLockedArtifacts,
      failOnError: preservesLockedArtifacts,
    });

    for (const file of files) {
      const relativePath = normalizePath(file.relativePath);

      if (shouldSkipFile(relativePath, options.target)) {
        continue;
      }

      const fileType = getFileType(relativePath);
      assets[relativePath] = {
        content: file.content,
        type: fileType,
      };
    }
  } catch (error) {
    if (options.target === 'tap-app') {
      throw error;
    }
    logFn('warn', `Failed to read build directory ${buildDir}: ${error}`);
  }

  return buildAssetsMap(assets, extractBuffer, getAssetType);
}

function shouldSkipFile(
  filePath: string,
  target: ZephyrBuildTarget | undefined
): boolean {
  // A TAP descriptor/lock can reference opaque files with conventional web-app names.
  // Do not silently omit any of them during package publication.
  if (target === 'tap-app') {
    return false;
  }

  // Skip common files that shouldn't be uploaded
  const skipPatterns = [
    /\.map$/, // Source maps
    /node_modules/, // Node modules
    /\.git/, // Git files
    /\.DS_Store$/, // macOS files
    /thumbs\.db$/i, // Windows files
  ];

  return skipPatterns.some((pattern) => pattern.test(filePath));
}

function getFileType(filePath: string): string {
  const extension = filePath.split('.').pop()?.toLowerCase() || '';

  const typeMap: Record<string, string> = {
    html: 'text/html',
    css: 'text/css',
    js: 'application/javascript',
    mjs: 'application/javascript',
    json: 'application/json',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    ico: 'image/x-icon',
    woff: 'font/woff',
    woff2: 'font/woff2',
    ttf: 'font/ttf',
    eot: 'application/vnd.ms-fontobject',
    xml: 'text/xml',
    txt: 'text/plain',
  };

  return typeMap[extension] || 'application/octet-stream';
}
