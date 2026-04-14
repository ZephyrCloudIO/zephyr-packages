import { BundleCacheLayer } from './BundleCacheLayer';
import type { MFECacheConfig } from './types';

let cacheLayerInstance: BundleCacheLayer | null = null;

/**
 * Register the MFE cache layer.
 *
 * Call this once at app startup (before any remote bundle loading). Sets up the cache
 * handler on `globalThis.__FEDERATION__.__NATIVE__` for asyncRequire integration and
 * starts background polling.
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

  // Ensure __FEDERATION__.__NATIVE__ namespace exists (register may run before MF runtime init)
  globalThis.__FEDERATION__ ??= {} as typeof globalThis.__FEDERATION__;
  globalThis.__FEDERATION__.__NATIVE__ ??= {};
  const ns = globalThis.__FEDERATION__.__NATIVE__;

  const cacheLayer = new BundleCacheLayer(config);
  cacheLayerInstance = cacheLayer;
  ns.__CACHE_LAYER__ = cacheLayer;

  // Determine whether cache is active in the current environment.
  // Production: always enabled. Dev: only when forceCacheInDev is true.
  const { forceCacheInDev = false } = config;
  const cacheEnabled = !__DEV__ || forceCacheInDev;

  // Register minimal cache handler for asyncRequire integration.
  // Only register when cache is enabled — asyncRequire uses the presence of
  // __FEDERATION__.__NATIVE__.__CACHE__ to decide split bundle URL conversion,
  // so it must be absent when cache is disabled to preserve original path behavior.
  if (cacheEnabled) {
    ns.__CACHE__ = async (
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

  // Expose manual polling APIs on globalThis
  globalThis.__MFE_CHECK_UPDATES__ = () => cacheLayer.checkForUpdates();
  globalThis.__MFE_START_UPDATE_POLLING__ = (intervalMs?: number) =>
    cacheLayer.startPolling(intervalMs);
  globalThis.__MFE_STOP_UPDATE_POLLING__ = () => cacheLayer.stopPolling();

  // Auto-start polling unless explicitly disabled
  const { enablePolling = true, pollIntervalMs } = config;
  if (enablePolling) {
    cacheLayer.startPolling(pollIntervalMs);
  }

  return cacheLayer;
}
