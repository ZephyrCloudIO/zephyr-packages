import type { ZeBuildAssetsMap } from 'zephyr-edge-contract';

import { zeBuildAssets } from './ze-build-assets';
import { ze_log } from '../logging';

interface ExtractBuffer<T> {
  (asset: T): Buffer | string | undefined;
}

interface GetAssetType<T> {
  (asset: T): string;
}

export type { ZeBuildAssetsMap } from 'zephyr-edge-contract';

export function buildAssetsMap<T>(
  assets: Record<string, T>,
  extractBuffer: ExtractBuffer<T>,
  getAssetType: GetAssetType<T>
) {
  return Object.keys(assets).reduce((memo, filepath) => {
    const asset = assets[filepath];
    const buffer = extractBuffer(asset);

    if (!buffer && buffer !== '') {
      ze_log(`unknown asset type: ${getAssetType(asset)}`);
      return memo;
    }

    const assetMap = zeBuildAssets({ filepath, content: buffer });
    memo[assetMap.hash] = assetMap;

    return memo;
  }, {} as ZeBuildAssetsMap);
}
