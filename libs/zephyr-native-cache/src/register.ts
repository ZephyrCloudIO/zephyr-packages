import { BundleCacheLayer } from './BundleCacheLayer';
import type { MFECacheConfig } from './types';

/**
 * Register the MFE cache layer on globalThis.**FEDERATION**.**NATIVE**.
 *
 * Call this once at app startup (before any remote bundle loading). metro-core reads
 * `globalThis.__FEDERATION__.__NATIVE__.__CACHE_LAYER__` — it never imports native-cache
 * directly, keeping the two packages decoupled.
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
  // Ensure __FEDERATION__.__NATIVE__ namespace exists (register may run before MF runtime init)
  const g = globalThis as any;
  g.__FEDERATION__ = g.__FEDERATION__ || {};
  g.__FEDERATION__.__NATIVE__ = g.__FEDERATION__.__NATIVE__ || {};
  const ns = g.__FEDERATION__.__NATIVE__;

  // Re-use existing instance if already registered
  if (ns.__CACHE_LAYER__) {
    return ns.__CACHE_LAYER__;
  }

  const cacheLayer = new BundleCacheLayer(config);
  ns.__CACHE_LAYER__ = cacheLayer;

  // Determine whether cache is active in the current environment.
  // Production: always enabled. Dev: only when forceCacheInDev is true.
  const { forceCacheInDev = false } = config;
  const cacheEnabled = !(globalThis as any).__DEV__ || forceCacheInDev;

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
  (globalThis as any).__MFE_CHECK_UPDATES__ = () => cacheLayer.checkForUpdates();
  (globalThis as any).__MFE_START_UPDATE_POLLING__ = (intervalMs?: number) =>
    cacheLayer.startPolling(intervalMs);
  (globalThis as any).__MFE_STOP_UPDATE_POLLING__ = () => cacheLayer.stopPolling();

  // Auto-start polling unless explicitly disabled
  const { enablePolling = true, pollIntervalMs } = config;
  if (enablePolling) {
    cacheLayer.startPolling(pollIntervalMs);
  }

  return cacheLayer;
}
