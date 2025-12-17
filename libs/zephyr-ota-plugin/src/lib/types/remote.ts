/**
 * Information about a remote's version status
 */
export interface RemoteVersionInfo {
  /**
   * Name of the remote (matches key in ZephyrDependencyConfig)
   */
  name: string;

  /**
   * Currently loaded version (snapshot_id), null if first launch
   */
  currentVersion: string | null;

  /**
   * Latest available version (snapshot_id)
   */
  latestVersion: string;

  /**
   * URL to the remote entry point
   */
  remoteEntryUrl: string;

  /**
   * Whether an update is available for this remote
   */
  hasUpdate: boolean;

  /**
   * Published timestamp of the latest version
   */
  publishedAt?: number;
}

/**
 * Stored version information for a remote (persisted in AsyncStorage)
 */
export interface StoredVersionInfo {
  /**
   * Version identifier (snapshot_id)
   */
  version: string;

  /**
   * Remote entry URL
   */
  url: string;

  /**
   * Timestamp when this version was stored
   */
  lastUpdated: number;

  /**
   * Published timestamp from version info endpoint
   */
  publishedAt?: number;
}

/**
 * Map of remote names to their stored version info
 */
export type StoredVersions = Record<string, StoredVersionInfo>;

/**
 * Result of an update check
 */
export interface UpdateCheckResult {
  /**
   * Whether any updates are available
   */
  hasUpdates: boolean;

  /**
   * Version info for all tracked remotes
   */
  remotes: RemoteVersionInfo[];

  /**
   * Timestamp when the check was performed
   */
  timestamp: number;
}
