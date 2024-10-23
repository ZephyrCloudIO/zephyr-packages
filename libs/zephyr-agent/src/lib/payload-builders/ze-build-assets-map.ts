import { Source, ze_log, ZeBuildAssetsMap, ZephyrPluginOptions } from 'zephyr-edge-contract';

import { getZeBuildAsset } from '../sync-utils/get-ze-build-asset';
import { onIndexHtmlResolved } from '../hacks/resolve-index-html';

function getAssetType<T>(asset: Source): string {
  return asset.constructor.name;
}

interface ExtractBuffer<T> {
  (asset: T): Buffer | string | undefined;
}

interface GetAssetType<T> {
  (asset: T): string;
}

function extractBuffer(asset: Source): Buffer | string | undefined {
  const className = getAssetType(asset);
  switch (className) {
    case 'CachedSource':
    case 'CompatSource':
    case 'RawSource':
    case 'ConcatSource':
    case 'SourceMapSource':
      return asset?.buffer && asset.buffer();
    case 'ReplaceSource':
      return asset.source();
    default:
      return void 0;
  }
}

export async function zeBuildAssetsMap(pluginOptions: ZephyrPluginOptions, assets: Record<string, Source>): Promise<ZeBuildAssetsMap> {
  ze_log('Building assets map from webpack assets.');

  const buildAssetMap = buildAssetsMap(assets, extractBuffer, getAssetType);

  ze_log('Assets map built. Checking for index.html waiter.');
  if (pluginOptions.wait_for_index_html) {
    const index_html_content = await onIndexHtmlResolved();
    const index_html_asset = getZeBuildAsset({
      filepath: 'index.html',
      content: index_html_content,
    });
    buildAssetMap[index_html_asset.hash] = index_html_asset;
    ze_log('Index.html added to assets map.');
  }

  return buildAssetMap;
}

export function buildAssetsMap<T>(assets: Record<string, T>, extractBuffer: ExtractBuffer<T>, getAssetType: GetAssetType<T>) {
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
