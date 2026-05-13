export { CacheManager } from './CacheManager';
export { BundleCacheLayer } from './BundleCacheLayer';
export { default as runtimePlugin } from './runtime-plugin';
export {
  checkForUpdates,
  clearCache,
  getCacheStatus,
  getRegisteredCacheLayer,
  register,
  startUpdatePolling,
  stopUpdatePolling,
  subscribeCacheStatus,
} from './register';
export { ZephyrNativeCache } from './ZephyrNativeCache';
// React hook (useCacheStatus) is intentionally NOT re-exported from the root
// barrel — import it from 'zephyr-native-cache/react' so non-React consumers
// don't pull React into their bundle (Metro/CJS output doesn't tree-shake).
export type { ZephyrNativeCacheApi } from './ZephyrNativeCache';
export type {
  CachePollResult,
  CacheStatusListener,
  CacheStatusRemoteEntry,
  CacheStatusSnapshot,
  CheckForUpdatesOptions,
  CheckForUpdatesResult,
  BundleMetadata,
  BundleLoadStatus,
  BundleStatus,
  CachedBundleResult,
  MFECacheConfig,
  UpdatePolicy,
} from './types';
export { CacheEvents } from './events';
export type {
  BundleLoadEvent,
  CacheEventMap,
  PollCompleteEvent,
  UpdateAvailableEvent,
  UpdateDownloadedEvent,
} from './events';
