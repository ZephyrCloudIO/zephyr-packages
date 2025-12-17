/**
 * Response from the Zephyr Cloud /resolve/{appUid}/{tag} endpoint
 */
export interface ZephyrResolveResponse {
  /**
   * Name of the application
   */
  name: string;

  /**
   * Version identifier (may be set from version info)
   */
  version?: string;

  /**
   * Application UID
   */
  application_uid: string;

  /**
   * Default URL for the application (base URL)
   */
  default_url: string;

  /**
   * URL to the remote entry bundle
   */
  remote_entry_url: string;

  /**
   * Library type (e.g., "module", "esm")
   */
  library_type?: string;

  /**
   * Target platform
   */
  platform?: string;

  /**
   * Published timestamp from version info endpoint
   */
  published_at?: number;

  /**
   * Versioned URL from version info endpoint
   */
  version_url?: string;
}

/**
 * Response from the /__get_version_info__ endpoint
 * This contains the actual deployed version metadata that changes with each deploy
 */
export interface VersionInfo {
  /**
   * Versioned URL that changes with each deployment
   */
  version_url: string;

  /**
   * Timestamp when this version was published
   */
  published_at: number;

  /**
   * Unique snapshot ID for this deployment
   */
  snapshot_id: string;
}

/**
 * Wrapper for API responses that have a "value" property
 */
export interface ApiResponseWrapper<T> {
  value: T;
}
