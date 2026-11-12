/* istanbul ignore file */

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
  /** Namespace reserved for zephyr-native-cache integrations. */
  nativeCache?: ZephyrNativeCacheNamespace;

  /**
   * Public `ZE_PUBLIC_*` environment values read by compiled mobile code, keyed by Zephyr
   * application UID. Values are strings; missing keys fall back to the build-time value
   * compiled into the bundle.
   */
  env?: Record<string, Readonly<Record<string, string>>>;

  /** Set by the embedded-remotes runtime plugin when the host embeds remotes. */
  embeddedRemotes?: ZephyrEmbeddedRemotes;
  [namespace: string]: unknown;
}

/** Loads remote bundles shipped inside the app binary (`embedRemotes`). */
export interface ZephyrEmbeddedRemotes {
  /** True for URLs under an embedded remote's origin. */
  owns(bundleUrl: string): boolean;
  /** Evaluates the embedded copy of the bundle. */
  load(bundleUrl: string): Promise<void>;
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
  /**
   * Set by zephyr-native-cache `register()`; the Zephyr env runtime plugin persists
   * manifests here when present.
   */
  envStorage?: ZephyrNativeEnvStorage;
  /** UTF-8 text of a file in the app binary root; undefined when it is missing. */
  readBundledFile?: (name: string) => Promise<string | undefined>;
  /** True when the bundle is cached (and matches `expectedHash` when given). */
  hasCachedBundle?: (bundleUrl: string, expectedHash?: string) => Promise<boolean>;
  /** Reports a bundle loaded from the copy embedded in the app. */
  recordEmbeddedLoad?: (bundleUrl: string, remoteName: string) => void;
  [key: string]: unknown;
}

/** Persistent string store for the last Zephyr environment manifest loaded per URL. */
export interface ZephyrNativeEnvStorage {
  getItem(key: string): Promise<string | undefined>;
  setItem(key: string, value: string): Promise<void>;
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
