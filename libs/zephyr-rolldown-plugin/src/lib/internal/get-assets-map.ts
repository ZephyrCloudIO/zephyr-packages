import type { ZeBuildAssetsMap } from 'zephyr-agent';
import { buildAssetsMap } from 'zephyr-agent';
import type { XOutputAsset, XOutputBundle, XOutputChunk } from 'zephyr-xpack-internal';

export function getAssetsMap(
  assets: XOutputBundle<XOutputChunk | XOutputAsset>
): ZeBuildAssetsMap {
  return buildAssetsMap<XOutputChunk | XOutputAsset>(assets, extractBuffer, getAssetType);
}

const extractBuffer = (asset: XOutputChunk | XOutputAsset): string | undefined => {
  switch (asset.type) {
    case 'chunk':
      return asset.code;
    case 'asset':
      return typeof asset.source === 'string'
        ? asset.source
        : new TextDecoder().decode(asset.source);
    default:
      return void 0;
  }
};

const getAssetType = (asset: XOutputChunk | XOutputAsset): string => asset.type;
