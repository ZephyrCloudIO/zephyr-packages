import type { ModuleFederationRuntimePlugin } from '@module-federation/runtime';
import { getZephyrNativeCacheNamespace } from './zephyr-global';
import { getBundleCacheKey } from './cache-key';
import type { ManifestArtifact, ManifestRelease } from './types';

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

export interface ManifestAssetItem {
  name?: string;
  hash?: string;
  assets?: { js?: { sync?: string[]; async?: string[] } };
}

export interface ManifestMetaData {
  publicPath?: string;
  buildInfo?: { hash?: string };
  remoteEntry?: { name?: string; path?: string };
}

export interface Manifest {
  metaData?: ManifestMetaData;
  exposes?: ManifestAssetItem[];
  shared?: ManifestAssetItem[];
}

interface RuntimePluginCacheLayer {
  registerManifestRelease: (release: ManifestRelease) => void;
  registerManifestSource: (
    manifestUrl: string,
    extractRelease: (manifest: Manifest, manifestUrl: string) => ManifestRelease,
    release?: ManifestRelease
  ) => void;
  getCachedManifest: (
    manifestUrl: string,
    extractRelease: (manifest: unknown, manifestUrl: string) => ManifestRelease
  ) => Promise<unknown | null>;
}

function getGlobalCacheLayer(): RuntimePluginCacheLayer | undefined {
  const cacheLayer = getZephyrNativeCacheNamespace()?.refs?.cacheLayer;
  if (!cacheLayer || typeof cacheLayer !== 'object') {
    return undefined;
  }

  const candidate = cacheLayer as Partial<RuntimePluginCacheLayer>;
  if (
    typeof candidate.registerManifestRelease !== 'function' ||
    typeof candidate.registerManifestSource !== 'function' ||
    typeof candidate.getCachedManifest !== 'function'
  ) {
    return undefined;
  }

  return candidate as RuntimePluginCacheLayer;
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

/**
 * Resolve the bundle paths for a manifest item.
 *
 * Dev vs production serves bundles from different locations:
 *
 * - Dev: Metro serves at source paths (e.g. "src/StatsCard.bundle") so we use
 *   assets.js.sync with the extension swapped to .bundle.
 * - Production: the MF Metro serializer writes exposed modules to "exposed/<name>.bundle"
 *   and shared modules to "shared/<name>.bundle", but the manifest's assets.js.sync still
 *   contains source paths. Shared entries already have correct output paths in
 *   assets.js.sync.
 */
function resolveBundlePaths(
  item: ManifestAssetItem,
  section: 'exposes' | 'shared'
): string[] {
  if ((item.assets?.js?.async?.length ?? 0) > 0) {
    throw Object.assign(new Error('Manifest contains unverifiable async JavaScript'), {
      code: 'INVALID_MANIFEST',
    });
  }

  const syncJs = item.assets?.js?.sync;
  if (section === 'shared' && (syncJs?.length ?? 0) > 1) {
    throw Object.assign(new Error('Shared module is not one verifiable artifact'), {
      code: 'INVALID_MANIFEST',
    });
  }

  if (__DEV__) {
    if (!syncJs?.length) return [];
    return syncJs.map((p) => p.replace(/\.\w+$/, '.bundle'));
  }

  if (section === 'exposes') {
    if (!item.name) {
      throw Object.assign(new Error('Exposed module name is missing'), {
        code: 'INVALID_MANIFEST',
      });
    }
    return [`exposed/${item.name}.bundle`];
  }

  if (!syncJs?.length) return [];
  return syncJs.map((p) => p.replace(/\.\w+$/, '.bundle'));
}

export function extractManifestRelease(
  manifest: Manifest,
  manifestUrl: string,
  remoteName?: string,
  resolvedContainerUrl?: string
): ManifestRelease {
  const artifacts = new Map<string, ManifestArtifact>();

  if (!Array.isArray(manifest?.exposes) || !Array.isArray(manifest?.shared)) {
    throw Object.assign(new Error('Manifest executable sections are missing'), {
      code: 'INVALID_MANIFEST',
    });
  }

  const rawPublicPath = manifest?.metaData?.publicPath ?? '';
  const resolvedPublicPath =
    rawPublicPath && rawPublicPath !== 'auto' && /^https?:\/\//.test(rawPublicPath)
      ? rawPublicPath
      : manifestUrl.replace(/\/[^/]*$/, '');

  function addArtifacts(
    items: ManifestAssetItem[] | undefined,
    section: 'exposes' | 'shared'
  ) {
    if (!Array.isArray(items)) return;
    for (const item of items) {
      for (const bundlePath of resolveBundlePaths(item, section)) {
        const bareUrl = resolvedPublicPath
          ? `${resolvedPublicPath.replace(/\/+$/, '')}/${bundlePath.replace(/^\.?\//, '')}`
          : bundlePath;
        const bundleUrl = buildUrlForSplitBundle(bareUrl);
        artifacts.set(getBundleCacheKey(bundleUrl), {
          bundleUrl,
          expectedHash: item.hash,
          kind: section === 'exposes' ? 'exposed' : 'shared',
        });
      }
    }
  }

  addArtifacts(manifest?.exposes, 'exposes');
  addArtifacts(manifest?.shared, 'shared');

  const remoteEntry = manifest?.metaData?.remoteEntry;
  const containerHash = manifest?.metaData?.buildInfo?.hash;
  if (!remoteEntry?.name) {
    throw Object.assign(new Error('Manifest remote entry is missing'), {
      code: 'INVALID_MANIFEST',
    });
  }
  if (resolvedContainerUrl) {
    artifacts.set(getBundleCacheKey(resolvedContainerUrl), {
      bundleUrl: resolvedContainerUrl,
      expectedHash: containerHash,
      kind: 'container',
    });
  } else if (resolvedPublicPath) {
    const entryPath = remoteEntry.path
      ? `${remoteEntry.path}/${remoteEntry.name}`
      : remoteEntry.name;
    const bareUrl = `${resolvedPublicPath.replace(/\/+$/, '')}/${entryPath.replace(/^\.?\//, '')}`;
    const bundleUrl = buildUrlForEntryBundle(bareUrl);
    artifacts.set(getBundleCacheKey(bundleUrl), {
      bundleUrl,
      expectedHash: containerHash,
      kind: 'container',
    });
  }

  const inferredRemoteName =
    remoteName ?? remoteEntry?.name?.replace(/\.[^.]+$/, '') ?? 'unknown';
  return {
    manifestId: inferredRemoteName,
    remoteName: inferredRemoteName,
    artifacts: Array.from(artifacts.values()),
    manifestUrl,
    manifestJson: manifest,
  };
}

// --- Runtime plugin ---

const ZEPHYR_GLOBAL_CACHE_PLUGIN_NAME = 'zephyr-native-cache-plugin';

export default function (): ModuleFederationRuntimePlugin {
  async function fetchHook(
    url: string,
    init: RequestInit,
    remoteInfo?: { name?: string },
    resourceContext?: { resourceType?: string }
  ): Promise<Response> {
    if (resourceContext?.resourceType !== 'manifest') return fetch(url, init);

    let failedResponse: Response | undefined;
    try {
      const response = await fetch(url, init);
      if (response.ok || response.status < 500) return response;
      failedResponse = response;
    } catch {
      // Fall through to the last complete active manifest.
    }

    const cacheLayer = getGlobalCacheLayer();
    const cached = cacheLayer
      ? await cacheLayer.getCachedManifest(url, (manifest, manifestUrl) =>
          extractManifestRelease(manifest as Manifest, manifestUrl, remoteInfo?.name)
        )
      : null;
    if (!cached) {
      if (failedResponse) return failedResponse;
      throw new Error(
        'Manifest network request failed and no verified cache is available'
      );
    }
    return new Response(JSON.stringify(cached), {
      headers: { 'content-type': 'application/json' },
      status: 200,
    });
  }

  function resolveHook(args: AfterResolveArgs) {
    const cacheLayer = getGlobalCacheLayer();
    if (!cacheLayer) return args;

    const { origin, remoteInfo, remote } = args;
    const manifestUrl =
      'entry' in remote ? (remote as { entry: string }).entry : undefined;
    if (manifestUrl && origin.snapshotHandler?.manifestCache) {
      const manifest = origin.snapshotHandler.manifestCache.get(manifestUrl) as
        | Manifest
        | undefined;
      if (manifest) {
        const remoteName =
          remoteInfo.name ??
          manifest.metaData?.remoteEntry?.name?.replace(/\.[^.]+$/, '') ??
          'unknown';
        const release = extractManifestRelease(
          manifest,
          manifestUrl,
          remoteName,
          remoteInfo.entry
        );
        cacheLayer.registerManifestRelease(release);
        cacheLayer.registerManifestSource(
          manifestUrl,
          (nextManifest, nextManifestUrl) =>
            extractManifestRelease(nextManifest, nextManifestUrl, remoteName),
          release
        );
      }
    }
    return args;
  }

  return {
    name: ZEPHYR_GLOBAL_CACHE_PLUGIN_NAME,
    fetch: fetchHook,
    afterResolve: resolveHook,
    beforeInit: (args: BeforeInitArgs) => {
      const globalPlugins = globalThis.__FEDERATION__.__GLOBAL_PLUGIN__ ?? [];
      if (!globalPlugins.find((p) => p.name === ZEPHYR_GLOBAL_CACHE_PLUGIN_NAME)) {
        globalPlugins.push({
          name: ZEPHYR_GLOBAL_CACHE_PLUGIN_NAME,
          afterResolve: resolveHook,
          fetch: fetchHook,
        });
      }
      return args;
    },
  };
}
