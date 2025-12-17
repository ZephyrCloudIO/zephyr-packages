/* istanbul ignore file */

// Core service
export {
  ZephyrOTAService,
  createZephyrOTAService,
  type UpdateListener,
} from './lib/core/ZephyrOTAService';

// React integration
export { ZephyrOTAProvider } from './lib/react/ZephyrOTAProvider';
export type {
  ZephyrOTAProviderProps,
  ZephyrOTAContextValue,
} from './lib/react/ZephyrOTAProvider';
export { useZephyrOTA } from './lib/react/useZephyrOTA';
export { useOTAStatus } from './lib/react/useOTAStatus';
export type { OTAStatusResult } from './lib/react/useOTAStatus';

// Types
export type {
  // Configuration
  ZephyrOTAConfig,
  ZephyrDependencyConfig,
  ParsedZephyrDependency,
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

// Platform utilities
export {
  getBuildTarget,
  isIOS,
  isAndroid,
  type BuildTarget,
} from './lib/utils/platform';

// Logging utilities (for debugging)
export {
  setDebugEnabled,
  isDebugEnabled,
} from './lib/utils/logger';
