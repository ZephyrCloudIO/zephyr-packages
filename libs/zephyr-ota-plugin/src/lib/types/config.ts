import { ZE_API_ENDPOINT } from 'zephyr-edge-contract';

/** Storage operation types for error handling */
export type StorageOperation =
  | 'getVersions'
  | 'saveVersions'
  | 'getLastCheck'
  | 'setLastCheck'
  | 'isDismissed'
  | 'dismiss'
  | 'clearDismiss'
  | 'clearAll';

/** Storage error event for error callbacks */
export interface StorageError {
  /** The operation that failed */
  operation: StorageOperation;
  /** The underlying error */
  error: Error;
  /** Timestamp when the error occurred */
  timestamp: number;
}

/** Handler for storage errors */
export type StorageErrorHandler = (error: StorageError) => void;

/** Configuration for the Zephyr OTA plugin */
export interface ZephyrOTAConfig {
  /**
   * Host app's deployed URL where zephyr-manifest.json is served.
   * This is required for manifest-based update detection.
   *
   * @example "https://myapp.zephyrcloud.app"
   */
  hostUrl: string;

  /**
   * Path to manifest file relative to hostUrl.
   *
   * @default "/zephyr-manifest.json"
   */
  manifestPath?: string;

  /**
   * Auth token for private applications. Can also be set via ZE_AUTH_TOKEN environment
   * variable.
   */
  authToken?: string;

  /** @deprecated No longer used in manifest-based flow */
  apiBaseUrl?: string;

  /** Check interval for periodic checks in milliseconds (default: 30 minutes) */
  checkInterval?: number;

  /**
   * Minimum interval between checks to avoid rate limiting in milliseconds (default: 5
   * minutes)
   */
  minCheckInterval?: number;

  /** Duration to suppress prompts after user dismisses in milliseconds (default: 1 hour) */
  dismissDuration?: number;

  /** Check for updates when app comes to foreground (default: true) */
  checkOnForeground?: boolean;

  /** Enable periodic background checks (default: true) */
  enablePeriodicChecks?: boolean;

  /** Enable debug logging (default: false) */
  debug?: boolean;

  /**
   * Callback for storage errors. Use this to monitor or handle storage failures (e.g.,
   * corrupted data, quota exceeded, permission issues).
   *
   * @example
   *   ```tsx
   *   <ZephyrOTAProvider
   *   config={{
   *   onStorageError: (err) => {
   *   console.error(`Storage ${err.operation} failed:`, err.error);
   *   // Send to error tracking service
   *   Sentry.captureException(err.error);
   *   },
   *   }}
   *   >
   *   <App />
   *   </ZephyrOTAProvider>
   *   ```;
   */
  onStorageError?: StorageErrorHandler;
}

/** Default configuration values (excludes required hostUrl) */
export const DEFAULT_OTA_CONFIG = {
  manifestPath: '/zephyr-manifest.json',
  authToken: '',
  apiBaseUrl: ZE_API_ENDPOINT(),
  checkInterval: 30 * 60 * 1000, // 30 minutes
  minCheckInterval: 5 * 60 * 1000, // 5 minutes
  dismissDuration: 60 * 60 * 1000, // 1 hour
  checkOnForeground: true,
  enablePeriodicChecks: true,
  debug: false,
  onStorageError: undefined as unknown as StorageErrorHandler,
} satisfies Omit<Required<ZephyrOTAConfig>, 'hostUrl'> & { hostUrl?: never };

/**
 * Dependencies configuration - maps remote names to zephyr: protocol strings Format: {
 * RemoteName: "zephyr:appName.projectName.orgName@environment" }
 */
export type ZephyrDependencyConfig = Record<string, string>;

/** Parsed zephyr dependency from the zephyr: protocol string */
export interface ParsedZephyrDependency {
  /** The name of the remote (key in ZephyrDependencyConfig) */
  name: string;

  /** Application UID in format: appName.projectName.orgName */
  applicationUid: string;

  /** Version tag (e.g., "staging", "production", "v1.0.0") */
  versionTag: string;
}

/**
 * Environment overrides for specific remotes. Maps remote name to its target environment.
 *
 * @example
 *   ```tsx
 *   const overrides: EnvironmentOverrides = {
 *     MFTextEditor: 'production',  // Use production for this remote
 *     MFNotesList: 'staging',      // Use staging for this remote
 *   };
 *   ```;
 */
export type EnvironmentOverrides = Record<string, string>;
