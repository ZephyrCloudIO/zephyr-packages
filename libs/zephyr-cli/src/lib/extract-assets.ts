import { sep } from 'node:path';
import {
  buildAssetsMap,
  readDirRecursiveWithContents,
  type ZeBuildAssetsMap,
} from 'zephyr-agent';

interface DirectoryAsset {
  content: Buffer | string;
  type: string;
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
  buildDir: string
): Promise<ZeBuildAssetsMap> {
  const assets: Record<string, DirectoryAsset> = {};
  const files = await readDirRecursiveWithContents(buildDir);

  for (const file of files) {
    const relativePath = normalizePath(file.relativePath);

    if (shouldSkipFile(relativePath)) {
      continue;
    }

    const fileType = getFileType(relativePath);
    assets[relativePath] = {
      content: file.content,
      type: fileType,
    };
  }

  return buildAssetsMap(assets, extractBuffer, getAssetType);
}

function shouldSkipFile(filePath: string): boolean {
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
