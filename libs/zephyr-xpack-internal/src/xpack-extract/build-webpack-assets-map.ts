import type { Source, ZeBuildAssetsMap } from 'zephyr-edge-contract';
import { 
  buildAssetsMap, 
  zeBuildAssets, 
  onIndexHtmlResolved, 
  ze_log,
  ZephyrEngine 
} from 'zephyr-agent';
import { applyBaseHrefToAssets } from 'zephyr-agent/src/lib/transformers/ze-basehref-handler';

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

export interface BuildWebpackAssetMapOptions {
  wait_for_index_html?: boolean;
  zephyr_engine?: ZephyrEngine;
}

export async function buildWebpackAssetMap(
  assets: Record<string, Source>,
  options: BuildWebpackAssetMapOptions
): Promise<ZeBuildAssetsMap> {
  const { wait_for_index_html, zephyr_engine } = options;

  ze_log('Building assets map from webpack assets.');
  let assetsMap: ZeBuildAssetsMap = buildAssetsMap(assets, extractBuffer, getAssetType);

  if (wait_for_index_html) {
    ze_log('Assets map built. Checking for index.html waiter.');

    const index_html_content = await onIndexHtmlResolved();
    const index_html_asset = zeBuildAssets({
      filepath: 'index.html',
      content: index_html_content,
    });
    assetsMap[index_html_asset.hash] = index_html_asset;
    ze_log('Index.html added to assets map.');
  }

  // Apply baseHref to asset paths if available
  if (zephyr_engine?.buildProperties?.baseHref) {
    ze_log(`Applying baseHref '${zephyr_engine.buildProperties.baseHref}' to asset paths.`);
    assetsMap = applyBaseHrefToAssets(assetsMap, zephyr_engine.buildProperties.baseHref);
  }

  return assetsMap;
}
