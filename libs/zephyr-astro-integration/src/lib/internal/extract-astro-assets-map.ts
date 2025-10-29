import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildAssetsMap, logFn, type ZeBuildAssetsMap } from 'zephyr-agent';

interface AstroAsset {
  content: Buffer | string;
  type: string;
}

function extractBuffer(asset: AstroAsset): Buffer | string | undefined {
  return asset.content;
}

function getAssetType(asset: AstroAsset): string {
  return asset.type;
}

/** Normalize path separators to forward slashes for cross-platform consistency */
function normalizePath(filePath: string): string {
  return filePath.split(sep).join('/');
}

/** Check if a path looks like a URL route rather than a filesystem path */
function looksLikeRoute(path: string): boolean {
  if (!path || !path.startsWith('/')) {
    return false;
  }

  // Dynamic routes have brackets
  if (path.includes('[') || path.includes(']')) {
    return true;
  }

  // Check if it's a real absolute filesystem path vs a route
  // Real absolute paths are typically long and contain multiple segments
  const segments = path.split('/').filter(Boolean);

  // Paths with just 1-2 segments like /about, /blog, /rss.xml are likely routes
  // Real filesystem paths like /Users/name/project/file.js have many segments
  if (segments.length <= 2) {
    return true;
  }

  return false;
}

type AstroAssets =
  | Record<string, unknown>
  | Map<string, unknown>
  | Array<unknown>
  | undefined
  | null;

/**
 * Extract assets map from Astro's build hook assets parameter. This is more efficient
 * than walking the filesystem manually.
 */
export async function extractAstroAssetsFromBuildHook(
  assets: AstroAssets,
  outputPath: string
): Promise<ZeBuildAssetsMap> {
  const astroAssets: Record<string, AstroAsset> = {};

  try {
    // Handle different possible structures of the assets parameter
    if (!assets) {
      // Fallback to filesystem walking if assets is not available
      return await extractAstroAssetsMap(outputPath);
    }

    // Assets might be an object, Map, or array depending on Astro version
    const assetEntries = extractAssetEntries(assets);

    for (const [filePath, assetInfo] of assetEntries) {
      try {
        let fullPath: string | null = null;

        // Handle URL objects or string paths
        if (assetInfo && typeof assetInfo === 'object' && 'href' in assetInfo) {
          // It's a URL object
          fullPath = fileURLToPath(assetInfo as URL);
        } else if (typeof assetInfo === 'string' && assetInfo) {
          // It's a string path - skip if it looks like a route
          if (looksLikeRoute(assetInfo)) {
            continue;
          }

          // Only treat as absolute if it's really an absolute filesystem path
          // (not just a route starting with /)
          fullPath =
            isAbsolute(assetInfo) && !looksLikeRoute(assetInfo)
              ? assetInfo // Absolute file system path
              : join(outputPath, assetInfo); // Relative path or route
        } else if (typeof filePath === 'string' && filePath) {
          // Use the key as the file path only if it looks like a file path
          if (looksLikeRoute(filePath)) {
            continue;
          }

          // Only treat as absolute if it's really an absolute filesystem path
          fullPath =
            isAbsolute(filePath) && !looksLikeRoute(filePath)
              ? filePath // Absolute file system path
              : join(outputPath, filePath); // Relative path or route
        }

        // Skip if we couldn't determine a valid file path
        if (!fullPath) {
          continue;
        }

        // Skip files we don't want to upload
        const relativePath = normalizePath(relative(outputPath, fullPath));
        if (shouldSkipFile(relativePath)) {
          continue;
        }

        // Read the file content
        const content = await readFile(fullPath);
        const fileType = getFileType(relativePath);

        astroAssets[relativePath] = {
          content,
          type: fileType,
        };
      } catch (readError) {
        logFn('warn', `Failed to read asset file ${filePath}: ${readError}`);
        continue;
      }
    }

    // If we didn't find any assets from the hook, fallback to filesystem walking
    if (Object.keys(astroAssets).length === 0) {
      return await extractAstroAssetsMap(outputPath);
    }

    return buildAssetsMap(astroAssets, extractBuffer, getAssetType);
  } catch (error) {
    logFn(
      'warn',
      'Error processing assets from Astro build hook:' + JSON.stringify(error, null, 2)
    );
    // Fallback to filesystem walking on any error
    return await extractAstroAssetsMap(outputPath);
  }
}

/**
 * Extract asset entries from the Astro assets parameter. Handles different possible data
 * structures.
 */
function extractAssetEntries(assets: AstroAssets): [string, unknown][] {
  const entries: [string, unknown][] = [];

  if (Array.isArray(assets)) {
    // Handle array of assets
    assets.forEach((asset) => {
      if (typeof asset === 'string') {
        entries.push([asset, asset]);
      } else if (asset && typeof asset === 'object') {
        // Could be an object with path/url properties
        const assetObj = asset as Record<string, unknown>;
        const path =
          assetObj['path'] || assetObj['url'] || assetObj['href'] || assetObj['pathname'];
        if (path && typeof path === 'string') {
          entries.push([path, asset]);
        }
      }
    });
  } else if (assets instanceof Map) {
    // Handle Map objects
    for (const [key, value] of assets.entries()) {
      entries.push([key, value]);
    }
  } else if (assets && typeof assets === 'object') {
    // Handle plain objects
    for (const [key, value] of Object.entries(assets)) {
      if (Array.isArray(value)) {
        // If value is an array, it might contain multiple assets for this route
        value.forEach((item) => {
          entries.push([key, item]);
        });
      } else {
        entries.push([key, value]);
      }
    }
  }

  return entries;
}

export async function extractAstroAssetsMap(buildDir: string): Promise<ZeBuildAssetsMap> {
  const assets: Record<string, AstroAsset> = {};

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
