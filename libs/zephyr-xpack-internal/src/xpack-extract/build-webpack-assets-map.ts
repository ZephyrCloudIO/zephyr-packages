import {
  buildAssetsMap,
  onIndexHtmlResolved,
  ZeErrors,
  ZephyrError,
  ze_log,
  zeBuildAssets,
} from 'zephyr-agent';
import type { Source, ZeBuildAssetsMap } from 'zephyr-edge-contract';

function getAssetType(asset: Source): string {
  return asset?.constructor?.name ?? typeof asset;
}

function extractBuffer(asset: Source): Buffer | string | undefined {
  // Webpack's Source contract exposes `buffer()` for the byte-exact form. Do not use a
  // constructor-name allowlist: valid source subclasses such as OriginalSource would
  // otherwise be silently omitted from a descriptor-locked TAP artifact graph.
  try {
    if (typeof asset?.buffer === 'function') {
      const content = asset.buffer();
      if (Buffer.isBuffer(content) || typeof content === 'string') {
        return content;
      }
    }
  } catch {
    // Some compatible sources only expose source(); try that form below.
  }

  try {
    if (typeof asset?.source === 'function') {
      const content = asset.source();
      if (Buffer.isBuffer(content) || typeof content === 'string') {
        return content;
      }
    }
  } catch {
    // The strict TAP preflight below turns an unreadable source into a publication error.
  }

  return undefined;
}

export interface BuildWebpackAssetMapOptions {
  wait_for_index_html?: boolean;
  /** Reject an emitted artifact whose byte representation cannot be read. */
  failOnUnsupportedSource?: boolean;
}

function cacheExtractedBuffers(): (source: Source) => Buffer | string | undefined {
  const contents = new Map<Source, Buffer | string | undefined>();

  return (source) => {
    if (contents.has(source)) {
      return contents.get(source);
    }

    const content = extractBuffer(source);
    contents.set(source, content);
    return content;
  };
}

function assertReadableTapSources(
  assets: Record<string, Source>,
  getBuffer: (source: Source) => Buffer | string | undefined
): void {
  for (const [path, source] of Object.entries(assets)) {
    if (getBuffer(source) !== undefined) continue;

    throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
      message:
        `Cannot publish TAP artifact ${JSON.stringify(path)} because its ${getAssetType(source)} ` +
        'source does not expose readable bytes.',
    });
  }
}

export async function buildWebpackAssetMap(
  assets: Record<string, Source>,
  props: BuildWebpackAssetMapOptions
): Promise<ZeBuildAssetsMap> {
  const { wait_for_index_html, failOnUnsupportedSource = false } = props;

  ze_log.upload('Building assets map from webpack assets.');
  const getBuffer = cacheExtractedBuffers();
  if (failOnUnsupportedSource) {
    assertReadableTapSources(assets, getBuffer);
  }
  const assetsMap: ZeBuildAssetsMap = buildAssetsMap(assets, getBuffer, getAssetType);

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
