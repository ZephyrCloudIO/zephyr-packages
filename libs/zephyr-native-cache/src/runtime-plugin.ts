import type { ModuleFederationRuntimePlugin } from '@module-federation/runtime';

type AfterResolveArgs = Parameters<
  NonNullable<ModuleFederationRuntimePlugin['afterResolve']>
>[0];

type BeforeInitArgs = Parameters<
  NonNullable<ModuleFederationRuntimePlugin['beforeInit']>
>[0];

/**
 * MF runtime plugin that extracts bundle hashes from manifests during remote resolution
 * and feeds them to the cache layer for integrity verification and background polling.
 *
 * Add to `runtimePlugins` in your metro MF config:
 *
 * ```js
 * runtimePlugins: [require.resolve('zephyr-native-cache/runtime-plugin')];
 * ```
 *
 * Uses `beforeInit` to register a global copy so nested remotes also get hash extraction
 * (same pattern as Tauri MF plugin).
 */

// --- Manifest types (subset used for hash extraction) ---

interface ManifestAssetItem {
  hash?: string;
  assets?: { js?: { sync?: string[] } };
}

interface ManifestMetaData {
  publicPath?: string;
  buildInfo?: { hash?: string };
  remoteEntry?: { name?: string; path?: string };
}

interface Manifest {
  metaData?: ManifestMetaData;
  exposes?: ManifestAssetItem[];
  shared?: ManifestAssetItem[];
}

// --- Hash extraction helpers (Metro-specific URL builders) ---

const getQueryParams = () => {
  const isFuseboxEnabled = !!globalThis.__FUSEBOX_HAS_FULL_CONSOLE_SUPPORT__;
  const queryParams: Record<string, string> = {
    platform: require('react-native').Platform.OS,
    dev: 'true',
    lazy: 'true',
    minify: 'false',
    runModule: 'true',
    modulesOnly: 'false',
  };

  if (isFuseboxEnabled) {
    queryParams.excludeSource = 'true';
    queryParams.sourcePaths = 'url-server';
  }

  return new URLSearchParams(queryParams);
};

const buildUrlForEntryBundle = (entry: string) => {
  if (__DEV__) {
    return `${entry}?${getQueryParams().toString()}`;
  }
  return entry;
};

const buildUrlForSplitBundle = (entry: string) => {
  if (__DEV__) {
    const params = getQueryParams();
    params.set('runModule', 'false');
    params.set('modulesOnly', 'true');
    return `${entry}?${params.toString()}`;
  }
  if (entry.includes('modulesOnly=') || entry.includes('runModule=')) {
    return entry;
  }
  return `${entry}?modulesOnly=true&runModule=false`;
};

function extractBundleHashes(
  manifest: Manifest,
  manifestUrl: string
): Map<string, string> {
  const hashes = new Map<string, string>();

  const rawPublicPath = manifest?.metaData?.publicPath ?? '';
  const resolvedPublicPath =
    rawPublicPath && rawPublicPath !== 'auto' && /^https?:\/\//.test(rawPublicPath)
      ? rawPublicPath
      : manifestUrl.replace(/\/[^/]*$/, '');

  function addHashes(items: ManifestAssetItem[] | undefined, isContainer: boolean) {
    if (!Array.isArray(items)) return;
    for (const item of items) {
      const hash = item.hash;
      const syncJs = item.assets?.js?.sync;
      if (hash && syncJs) {
        for (const assetPath of syncJs) {
          const bundlePath = assetPath.replace(/\.\w+$/, '.bundle');
          const bareUrl = resolvedPublicPath
            ? `${resolvedPublicPath.replace(/\/+$/, '')}/${bundlePath.replace(/^\.?\//, '')}`
            : bundlePath;
          const fullUrl = isContainer
            ? buildUrlForEntryBundle(bareUrl)
            : buildUrlForSplitBundle(bareUrl);
          hashes.set(fullUrl, hash);
        }
      }
    }
  }

  addHashes(manifest?.exposes, false);
  addHashes(manifest?.shared, false);

  const remoteEntry = manifest?.metaData?.remoteEntry;
  const containerHash = manifest?.metaData?.buildInfo?.hash;
  if (remoteEntry?.name && containerHash && resolvedPublicPath) {
    const entryPath = remoteEntry.path
      ? `${remoteEntry.path}/${remoteEntry.name}`
      : remoteEntry.name;
    const bareUrl = `${resolvedPublicPath.replace(/\/+$/, '')}/${entryPath.replace(/^\.?\//, '')}`;
    hashes.set(buildUrlForEntryBundle(bareUrl), containerHash);
  }

  return hashes;
}

// --- Runtime plugin ---

const ZEPHYR_GLOBAL_CACHE_PLUGIN_NAME = 'zephyr-native-cache-plugin';

export default function (): ModuleFederationRuntimePlugin {
  function resolveHook(args: AfterResolveArgs) {
    try {
      const cacheLayer = globalThis.__FEDERATION__.__NATIVE__?.__CACHE_LAYER__;
      if (!cacheLayer) return args;

      const { origin, remoteInfo, remote } = args;
      const manifestUrl =
        'entry' in remote ? (remote as { entry: string }).entry : undefined;
      if (manifestUrl && origin.snapshotHandler?.manifestCache) {
        const manifest = origin.snapshotHandler.manifestCache.get(manifestUrl) as
          | Manifest
          | undefined;
        if (manifest) {
          const containerHash = manifest.metaData?.buildInfo?.hash;
          if (containerHash && remoteInfo.entry) {
            cacheLayer.registerBundleHash(remoteInfo.entry, containerHash);
          }

          const hashes = extractBundleHashes(manifest, manifestUrl);
          for (const [url, hash] of hashes) {
            cacheLayer.registerBundleHash(url.split('?')[0], hash);
          }

          cacheLayer.registerManifestSource(manifestUrl, extractBundleHashes);
        }
      }
    } catch {
      // non-critical — hash validation is best-effort
    }
    return args;
  }

  return {
    name: ZEPHYR_GLOBAL_CACHE_PLUGIN_NAME,
    afterResolve: resolveHook,
    beforeInit: (args: BeforeInitArgs) => {
      const globalPlugins = globalThis.__FEDERATION__.__GLOBAL_PLUGIN__ ?? [];
      if (!globalPlugins.find((p) => p.name === ZEPHYR_GLOBAL_CACHE_PLUGIN_NAME)) {
        globalPlugins.push({
          name: ZEPHYR_GLOBAL_CACHE_PLUGIN_NAME,
          afterResolve: resolveHook,
        });
      }
      return args;
    },
  };
}
