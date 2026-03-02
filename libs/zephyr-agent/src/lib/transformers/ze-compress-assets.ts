import { gzipSync } from 'node:zlib';
import type { ZeBuildAssetsMap } from 'zephyr-edge-contract';
import { zeBuildAssets } from './ze-build-assets';

const MAX_UPLOAD_PAYLOAD_BYTES = 25 * 1024 * 1024;

function shouldCompressAsset(size: number, contentEncoding?: string): boolean {
  if (contentEncoding) {
    return false;
  }

  return size > MAX_UPLOAD_PAYLOAD_BYTES;
}

/**
 * Compresses large assets before upload and marks them with content encoding metadata.
 *
 * This keeps transport payloads significantly smaller while preserving the original asset
 * path and extension for runtime lookup.
 */
export function compressLargeAssets(assetsMap: ZeBuildAssetsMap): ZeBuildAssetsMap {
  return Object.values(assetsMap).reduce((memo, asset) => {
    if (!shouldCompressAsset(asset.size, asset.contentEncoding)) {
      memo[asset.hash] = asset;
      return memo;
    }

    const buffer =
      typeof asset.buffer === 'string' ? Buffer.from(asset.buffer) : asset.buffer;
    const compressed = gzipSync(buffer, { level: 9 });

    // Keep original binary if compression is not beneficial.
    if (compressed.length >= buffer.length) {
      memo[asset.hash] = asset;
      return memo;
    }

    const compressedAsset = zeBuildAssets({
      filepath: asset.path,
      content: compressed,
      contentEncoding: 'gzip',
    });
    memo[compressedAsset.hash] = compressedAsset;

    return memo;
  }, {} as ZeBuildAssetsMap);
}
