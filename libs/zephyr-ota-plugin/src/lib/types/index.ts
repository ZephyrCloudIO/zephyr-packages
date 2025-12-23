// Configuration types
export type {
  ZephyrOTAConfig,
  StorageOperation,
  StorageError,
  StorageErrorHandler,
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
export type {
  VersionInfo,
  ManifestFetchResult,
  DependencyVersionCheck,
  ZephyrManifest,
  ZephyrDependency,
} from './api';
