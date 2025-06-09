import { buildAssetsMap, onIndexHtmlResolved, ze_log, zeBuildAssets } from 'zephyr-agent';
import type { Source, ZeBuildAssetsMap } from 'zephyr-edge-contract';

function getAssetType(asset: Source): string {
  return asset.constructor.name;
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

export async function buildWebpackAssetMap(
  assets: Record<string, Source>,
  props: { wait_for_index_html?: boolean }
): Promise<ZeBuildAssetsMap> {
  const { wait_for_index_html } = props;

  ze_log.upload('Building assets map from webpack assets.');
  const assetsMap: ZeBuildAssetsMap = buildAssetsMap(assets, extractBuffer, getAssetType);

  if (wait_for_index_html) {
    ze_log.upload('Assets map built. Checking for index.html waiter.');

    const index_html_content = await onIndexHtmlResolved();
    const index_html_asset = zeBuildAssets({
      filepath: 'index.html',
      content: index_html_content,
    });
    assetsMap[index_html_asset.hash] = index_html_asset;
    ze_log.misc('Index.html added to assets map.');
  }

  return assetsMap;
}
