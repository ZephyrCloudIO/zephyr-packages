import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { buildAssetsMap, logFn, type ZeBuildAssetsMap } from 'zephyr-agent';

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

  // Recursively walk through the build directory
  async function walkDir(dirPath: string): Promise<void> {
    try {
      const entries = await readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dirPath, entry.name);

        if (entry.isDirectory()) {
          await walkDir(fullPath);
        } else if (entry.isFile()) {
          // Get relative path from build directory
          const relativePath = normalizePath(relative(buildDir, fullPath));

          // Skip certain files that shouldn't be uploaded
          if (shouldSkipFile(relativePath)) {
            continue;
          }

          try {
            const content = await readFile(fullPath);
            const fileType = getFileType(relativePath);

            assets[relativePath] = {
              content,
              type: fileType,
            };
          } catch (readError) {
            logFn('warn', `Failed to read file ${fullPath}: ${readError}`);
          }
        }
      }
    } catch (error) {
      logFn('warn', `Failed to walk directory ${dirPath}: ${error}`);
    }
  }

  await walkDir(buildDir);

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
