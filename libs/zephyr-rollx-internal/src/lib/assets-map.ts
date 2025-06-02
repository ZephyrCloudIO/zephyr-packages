import type { ZeBuildAssetsMap } from 'zephyr-agent';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { buildAssetsMap, ze_log } from 'zephyr-agent';
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
): string | undefined => {
  switch (asset.type) {
    case 'chunk':
      return asset.code;
    case 'asset':
      if (typeof asset.source === 'string') {
        return asset.source;
      } else if (asset.source instanceof Uint8Array) {
        try {
          return new TextDecoder().decode(asset.source);
        } catch (error) {
          // If decoding fails (e.g., binary data), return base64 or handle gracefully
          ze_log('Error decoding asset source', error);

          return new TextDecoder('utf-8', { fatal: false }).decode(asset.source);
        }
      }
      return void 0;
    default:
      return void 0;
  }
};

export const getRollxAssetType = (asset: XOutputChunk | XOutputAsset): string =>
  asset.type;
