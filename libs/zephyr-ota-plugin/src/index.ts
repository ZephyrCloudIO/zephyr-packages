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
  ZephyrDependencyConfig,
  ParsedZephyrDependency,
  EnvironmentOverrides,
  // Storage errors
  StorageOperation,
  StorageError,
  StorageErrorHandler,
  // State
  RemoteVersionInfo,
  StoredVersionInfo,
  StoredVersions,
  UpdateCheckResult,
  // API
  ZephyrResolveResponse,
  VersionInfo,
} from './lib/types';
export { DEFAULT_OTA_CONFIG } from './lib/types';

// Utilities
export {
  parseZephyrDependency,
  parseZephyrDependencies,
  parseZephyrProtocol,
  isValidZephyrProtocol,
} from './lib/utils/parse-dependencies';

// Auto-detection utilities
export {
  detectRemotesFromRuntime,
  buildDependenciesConfig,
  type DetectedRemote,
} from './lib/utils/detect-remotes';

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
