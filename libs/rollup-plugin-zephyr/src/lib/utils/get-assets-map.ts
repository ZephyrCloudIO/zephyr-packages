import { OutputAsset, OutputBundle, OutputChunk } from 'rollup';
import { getZeBuildAsset } from 'zephyr-agent';
import { ze_log, ZeBuildAssetsMap } from 'zephyr-edge-contract';

const extractBuffer = (
  asset: OutputChunk | OutputAsset
): string | undefined => {
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

const getAssetType = (asset: OutputChunk | OutputAsset): string =>
  asset.type;

export function getAssetsMap(assets: OutputBundle): ZeBuildAssetsMap {
  return Object.keys(assets).reduce((memo, filepath) => {
    const asset = assets[filepath];
    const buffer = extractBuffer(asset);

    if (!buffer && buffer !== '') {
      ze_log(`unknown asset type: ${getAssetType(asset)}`);
      return memo;
    }

    const assetMap = getZeBuildAsset({ filepath, content: buffer });
    memo[assetMap.hash] = assetMap;

    return memo;
  }, {} as ZeBuildAssetsMap);
}
