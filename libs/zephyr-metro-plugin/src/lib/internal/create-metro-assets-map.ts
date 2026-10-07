import type { ZeBuildAssetsMap } from 'zephyr-agent';
import { zeBuildAssets } from 'zephyr-agent';
import type { OutputAsset } from './types';

export function createMetroAssetsMap(
  assets: Record<string, OutputAsset>
): ZeBuildAssetsMap {
  const result: ZeBuildAssetsMap = {};
  const paths = new Set<string>();
  for (const [key, asset] of Object.entries(assets)) {
    const path = asset.fileName || key;
    if (!path || paths.has(path))
      throw new Error(`Duplicate or empty Metro asset path: ${path}`);
    paths.add(path);
    let content: Buffer | string;
    if (typeof asset.source === 'string') content = asset.source;
    else if (Buffer.isBuffer(asset.source)) content = asset.source;
    else
      content = Buffer.from(
        asset.source.buffer,
        asset.source.byteOffset,
        asset.source.byteLength
      );
    const mapped = zeBuildAssets({ filepath: path, content });
    result[mapped.hash] = mapped;
  }
  if (paths.size !== Object.keys(result).length)
    throw new Error('Metro assets contain duplicate or unrepresentable paths');
  return result;
}
