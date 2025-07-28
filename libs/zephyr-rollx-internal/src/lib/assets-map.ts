import type { ZeBuildAssetsMap } from 'zephyr-agent';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { buildAssetsMap } from 'zephyr-agent';
import type { XOutputAsset, XOutputBundle, XOutputChunk } from '../types';

export function getRollxAssetsMap(
  assets: XOutputBundle<XOutputChunk | XOutputAsset>
): ZeBuildAssetsMap {
  return buildAssetsMap<XOutputChunk | XOutputAsset>(
    assets,
    extractRollxBuffer,
    getRollxAssetType
  );
}

export const extractRollxBuffer = (
  asset: XOutputChunk | XOutputAsset
): string | Buffer | undefined => {
  switch (asset.type) {
    case 'chunk':
      return asset.code;
    case 'asset':
      if (typeof asset.source === 'string') {
        return asset.source;
      }
      return Buffer.from(asset.source);
    default:
      return undefined;
  }
};

export const getRollxAssetType = (asset: XOutputChunk | XOutputAsset): string =>
  asset.type;
