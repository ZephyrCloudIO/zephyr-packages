import { BundleCacheLayer } from './BundleCacheLayer';
import type {
  CacheStatusListener,
  CacheStatusSnapshot,
  CheckForUpdatesOptions,
  CheckForUpdatesResult,
  MFECacheConfig,
} from './types';
import {
  ensureZephyrNativeCacheControls,
  ensureZephyrNativeCacheRefs,
  ensureZephyrNativeCacheState,
} from './zephyr-global';

let cacheLayerInstance: BundleCacheLayer | null = null;

/**
 * Register the MFE cache layer.
 *
 * Call this once at app startup (before any remote bundle loading). Sets up the cache
 * handler on `globalThis.__FEDERATION__.__NATIVE__` for asyncRequire integration, then
 * registers Zephyr-owned state and controls under `globalThis.__ZEPHYR__`.
 *
 * The runtime plugin (`zephyr-native-cache/runtime-plugin`) must be added separately to
 * `runtimePlugins` in the metro MF config to enable hash extraction from manifests during
 * remote resolution.
 *
 * @example
 *   ```ts
 *   import { register } from 'zephyr-native-cache';
 *
 *   register({
 *     maxCacheSizeBytes: 50 * 1024 * 1024,
 *     maxAgeMs: 3 * 24 * 60 * 60 * 1000,
 *     enablePolling: true,
 *     pollIntervalMs: 10 * 60 * 1000,
 *   });
 *   ```;
 */
export function register(config: MFECacheConfig = {}): BundleCacheLayer {
  if (cacheLayerInstance) return cacheLayerInstance;

  // Ensure MF namespace exists (register may run before MF runtime init).
  // This remains a compatibility bridge for asyncRequire only.
  globalThis.__FEDERATION__ ??= {} as typeof globalThis.__FEDERATION__;
  globalThis.__FEDERATION__.__NATIVE__ ??= {};
  const federationNativeNamespace = globalThis.__FEDERATION__.__NATIVE__;

  const cacheLayer = new BundleCacheLayer(config);
  cacheLayerInstance = cacheLayer;

  const nativeCacheRefs = ensureZephyrNativeCacheRefs();
  nativeCacheRefs.cacheLayer = cacheLayer;

  // Determine whether cache is active in the current environment.
  // Production: always enabled. Dev: only when forceCacheInDev is true.
  const { forceCacheInDev = false } = config;
  const cacheEnabled = !__DEV__ || forceCacheInDev;

  const nativeCacheState = ensureZephyrNativeCacheState();
  nativeCacheState.cacheEnabled = cacheEnabled;
  nativeCacheState.forceCacheInDev = forceCacheInDev;
  nativeCacheState.pollIntervalMs = cacheLayer.getStatus().pollIntervalMs;
  nativeCacheState.registeredAt = Date.now();

  cacheLayer.subscribeStatus((status) => {
    nativeCacheState.pollIntervalMs = status.pollIntervalMs;
    nativeCacheState.pollingEnabled = status.pollingEnabled;
    nativeCacheState.isPolling = status.isPolling;
    nativeCacheState.lastPollAt = status.lastPollAt;
    nativeCacheState.lastPollChecked = status.lastPollResult?.checked;
    nativeCacheState.lastPollUpdated = status.lastPollResult?.updated;
    nativeCacheState.pendingUpdates = [...status.pendingUpdates];
  });

  // Register minimal cache handler for asyncRequire integration.
  // Only register when cache is enabled — asyncRequire uses the presence of
  // __FEDERATION__.__NATIVE__.__CACHE__ to decide split bundle URL conversion,
  // so it must be absent when cache is disabled to preserve original path behavior.
  if (cacheEnabled) {
    federationNativeNamespace.__CACHE__ = async (
      fallback: (bundlePath: string) => Promise<void>,
      bundlePath: string
    ): Promise<void> => {
      // Full URLs (container bundles + remote split bundles) go through cache.
      // Relative paths are host's own split bundles — handled by Expo directly.
      if (/^https?:\/\//.test(bundlePath)) {
        const { status } = await cacheLayer.loadBundle(bundlePath);
        if (status === 'skipped') {
          await fallback(bundlePath);
        }
        // cache-hit or downloaded: bundle already eval'd by cache layer
      } else {
        await fallback(bundlePath);
      }
    };
  }

  const nativeCacheControls = ensureZephyrNativeCacheControls();
  const checkForUpdatesControl = (options?: unknown) =>
    cacheLayer.checkForUpdates(options as CheckForUpdatesOptions);
  const startUpdatePollingControl = (intervalMs?: number) =>
    cacheLayer.startPolling(intervalMs);
  const stopUpdatePollingControl = () => cacheLayer.stopPolling();
  const clearCacheControl = async () => {
    await cacheLayer.clearCache();
  };

  nativeCacheControls.checkForUpdates = checkForUpdatesControl;
  nativeCacheControls.startUpdatePolling = startUpdatePollingControl;
  nativeCacheControls.stopUpdatePolling = stopUpdatePollingControl;
  nativeCacheControls.clearCache = clearCacheControl;

  // Expose manual polling APIs on globalThis
  globalThis.__MFE_CHECK_UPDATES__ = checkForUpdatesControl;
  globalThis.__MFE_START_UPDATE_POLLING__ = startUpdatePollingControl;
  globalThis.__MFE_STOP_UPDATE_POLLING__ = stopUpdatePollingControl;

  // Auto-start polling unless explicitly disabled
  const { enablePolling = true, pollIntervalMs } = config;
  if (enablePolling) {
    cacheLayer.startPolling(pollIntervalMs);
  }

  return cacheLayer;
}

export function getRegisteredCacheLayer(): BundleCacheLayer | null {
  return cacheLayerInstance;
}

export function getCacheStatus(): CacheStatusSnapshot | null {
  return cacheLayerInstance?.getStatus() ?? null;
}

export function subscribeCacheStatus(listener: CacheStatusListener): () => void {
  if (!cacheLayerInstance) return () => {};
  return cacheLayerInstance.subscribeStatus(listener);
}

export async function checkForUpdates(
  options?: CheckForUpdatesOptions
): Promise<CheckForUpdatesResult> {
  if (!cacheLayerInstance) {
    return { updated: 0, checked: 0, applied: false };
  }
  return cacheLayerInstance.checkForUpdates(options);
}

export function startUpdatePolling(intervalMs?: number): void {
  cacheLayerInstance?.startPolling(intervalMs);
}

export function stopUpdatePolling(): void {
  cacheLayerInstance?.stopPolling();
}

export async function clearCache(): Promise<void> {
  if (!cacheLayerInstance) return;
  await cacheLayerInstance.clearCache();
}
