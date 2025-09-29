import type { ZephyrDependency } from './zephyr-build-stats';

export const ZEPHYR_MANIFEST_VERSION = '1.0.0';
export const ZEPHYR_MANIFEST_FILENAME = 'zephyr-manifest.json';

/**
 * OTA Contract Documentation:
 *
 * VERSIONING RULES:
 *
 * - Version field follows semver (major.minor.patch)
 * - Timestamp is ISO string for freshness comparison
 * - Dependencies map contains immutable remote URLs
 *
 * CACHE HEADERS (when serving manifest):
 *
 * - Content-Type: application/json
 * - Cache-Control: no-cache (force revalidation)
 * - ETag: based on version + timestamp hash
 *
 * AUTH REQUIREMENTS:
 *
 * - Public manifests: no auth required
 * - Private/enterprise: Bearer token in Authorization header
 * - CORS headers required for browser-based OTA checks
 *
 * IMMUTABLE COUPLING:
 *
 * - Urls.version from zeUploadSnapshot response MUST match manifest.version
 * - Remote entry URLs in dependencies are immutable per version
 * - Changing any dependency URL requires new version bump
 */
export interface ZephyrManifest {
  /** Semantic version following major.minor.patch */
  version: string;
  /** ISO timestamp for freshness checks */
  timestamp: string;
  /** Immutable remote dependencies for this version */
  dependencies: Record<string, ZephyrDependency>;
  zeVars: Record<string, string>;
  /** Optional: OTA-specific metadata */
  ota_enabled?: boolean;
  /** Optional: Application identifier for OTA */
  application_uid?: string;
}

/** OTA-specific manifest extensions */
export interface OTAManifest extends ZephyrManifest {
  ota_enabled: true;
  application_uid: string;
  /** Release notes for this version */
  release_notes?: string;
  /** Whether this update is critical */
  critical?: boolean;
  /** Minimum app version required for this update */
  min_app_version?: string;
}

/** OTA version check request */
export interface OTACheckRequest {
  application_uid: string;
  current_version?: string;
  current_timestamp?: string;
  platform?: 'ios' | 'android';
}

/** OTA version check response */
export interface OTAVersionResponse {
  version: string;
  timestamp: string;
  manifest_url: string;
  description?: string;
  critical?: boolean;
  release_notes?: string;
}
