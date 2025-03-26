import { OutputAsset, OutputBundle, OutputChunk } from 'rollup';
import { buildAssetsMap, ZeBuildAssetsMap } from 'zephyr-agent';

export function getAssetsMap(assets: OutputBundle): ZeBuildAssetsMap {
  return buildAssetsMap(assets, extractBuffer, getAssetType);
}

const extractBuffer = (asset: OutputChunk | OutputAsset): string | undefined => {
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

const getAssetType = (asset: OutputChunk | OutputAsset): string => asset.type;
