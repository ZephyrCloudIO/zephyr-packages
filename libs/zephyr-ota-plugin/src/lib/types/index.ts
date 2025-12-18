// Configuration types
export type {
  ZephyrOTAConfig,
  ZephyrDependencyConfig,
  ParsedZephyrDependency,
  EnvironmentOverrides,
} from './config';
export { DEFAULT_OTA_CONFIG } from './config';

// Remote version types
export type {
  RemoteVersionInfo,
  StoredVersionInfo,
  StoredVersions,
  UpdateCheckResult,
} from './remote';

// API types
export type { ZephyrResolveResponse, VersionInfo, ApiResponseWrapper } from './api';
