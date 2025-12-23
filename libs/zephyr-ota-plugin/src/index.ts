/* istanbul ignore file */

// Core service
export { ZephyrOTAService, type UpdateListener } from './lib/core/ZephyrOTAService';

// React integration
export { ZephyrOTAProvider, useZephyrOTA } from './lib/react/ZephyrOTAProvider';
export type {
  ZephyrOTAProviderProps,
  ZephyrOTAContextValue,
} from './lib/react/ZephyrOTAProvider';
export { useOTAStatus } from './lib/react/useOTAStatus';
export type { OTAStatusResult } from './lib/react/useOTAStatus';

// Types
export type {
  // Configuration
  ZephyrOTAConfig,
  // Storage errors
  StorageOperation,
  StorageError,
  StorageErrorHandler,
  // State
  RemoteVersionInfo,
  StoredVersionInfo,
  StoredVersions,
  UpdateCheckResult,
  // API / Manifest types
  VersionInfo,
  ManifestFetchResult,
  DependencyVersionCheck,
  ZephyrManifest,
  ZephyrDependency,
} from './lib/types';
export { DEFAULT_OTA_CONFIG } from './lib/types';

// Platform utilities
export { getBuildTarget, isIOS, isAndroid, type BuildTarget } from './lib/utils/platform';

// Logging utilities (for debugging)
export {
  enableDebug,
  disableDebug,
  isDebugEnabled,
  setDebugEnabled,
  ze_ota_log,
} from './lib/utils/logger';
