/* istanbul ignore file */

import type { ZephyrManifest } from './zephyr-manifest';

/**
 * Global Zephyr runtime namespace contract.
 *
 * This object is intended to live on `globalThis.__ZEPHYR__` and, in browser
 * environments, on `window.__ZEPHYR__`.
 */
export interface ZephyrGlobalNamespace {
  /** Schema version for the global namespace contract. */
  version: 1;

  /** Runtime feature namespaces managed by Zephyr packages. */
  runtime: ZephyrRuntimeNamespace;
}

export interface ZephyrRuntimeNamespace {
  /** Runtime manifests keyed by their absolute URL. */
  manifests?: Record<string, ZephyrRuntimeManifestEntry>;

  /** Namespace reserved for zephyr-native-cache integrations. */
  nativeCache?: ZephyrNativeCacheNamespace;
  [namespace: string]: unknown;
}

export interface ZephyrRuntimeManifestEntry {
  /** HTTP validator returned for this manifest response. */
  etag: string;

  /** Parsed zephyr-manifest.json response body. */
  manifest: ZephyrManifest;
}

export interface ZephyrNativeCacheNamespace {
  /** App-facing or internal control functions. */
  controls?: ZephyrNativeCacheControls;

  /** Runtime references kept for integrations/debugging. */
  refs?: ZephyrNativeCacheRefs;

  /** Runtime state snapshot metadata for integrations/debugging. */
  state?: ZephyrNativeCacheState;
}

export interface ZephyrNativeCacheControls {
  checkForUpdates?: (options?: unknown) => Promise<unknown>;
  startUpdatePolling?: (intervalMs?: number) => void;
  stopUpdatePolling?: () => void;
  clearCache?: () => Promise<void>;
  [key: string]: unknown;
}

export interface ZephyrNativeCacheRefs {
  cacheLayer?: unknown;
  bundleHashes?: Record<string, string>;
  [key: string]: unknown;
}

export interface ZephyrNativeCacheState {
  cacheEnabled?: boolean;
  forceCacheInDev?: boolean;
  pollIntervalMs?: number;
  pollingEnabled?: boolean;
  isPolling?: boolean;
  registeredAt?: number;
  lastPollAt?: number;
  lastPollChecked?: number;
  lastPollUpdated?: number;
  pendingUpdates?: string[];
  [key: string]: unknown;
}

declare global {
  var __ZEPHYR__: ZephyrGlobalNamespace | undefined;

  interface Window {
    __ZEPHYR__?: ZephyrGlobalNamespace;
  }
}
