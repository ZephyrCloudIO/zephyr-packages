import type { BundleCacheLayer } from './BundleCacheLayer';
import NativeMFECache from './NativeMFECache';
import {
  checkForUpdates,
  clearCache,
  getCacheStatus,
  register,
  startUpdatePolling,
  stopUpdatePolling,
  subscribeCacheStatus,
} from './register';
import type {
  CacheStatusListener,
  CacheStatusSnapshot,
  CheckForUpdatesOptions,
  CheckForUpdatesResult,
  MFECacheConfig,
} from './types';

export interface ZephyrNativeCacheApi {
  register(config?: MFECacheConfig): BundleCacheLayer;
  getStatus(): CacheStatusSnapshot | null;
  subscribe(listener: CacheStatusListener): () => void;
  checkForUpdates(options?: CheckForUpdatesOptions): Promise<CheckForUpdatesResult>;
  startUpdatePolling(intervalMs?: number): void;
  stopUpdatePolling(): void;
  clearCache(): Promise<void>;
  /** Reloads the React Native JS context without terminating the native app. */
  reloadApp(): void;
}

function reloadApp(): void {
  NativeMFECache?.restart();
}

export const ZephyrNativeCache: ZephyrNativeCacheApi = {
  register,
  getStatus: getCacheStatus,
  subscribe: subscribeCacheStatus,
  checkForUpdates,
  startUpdatePolling,
  stopUpdatePolling,
  clearCache,
  reloadApp,
};

export default ZephyrNativeCache;
