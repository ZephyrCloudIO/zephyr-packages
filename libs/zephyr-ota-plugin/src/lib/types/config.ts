import { ZE_API_ENDPOINT } from 'zephyr-edge-contract';

/** Configuration for the Zephyr OTA plugin */
export interface ZephyrOTAConfig {
  /**
   * Auth token for private applications. Can also be set via ZE_AUTH_TOKEN environment
   * variable.
   */
  authToken?: string;

  /** API base URL (default: https://zeapi.zephyrcloud.app) */
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
}

/** Default configuration values */
export const DEFAULT_OTA_CONFIG: Required<ZephyrOTAConfig> = {
  authToken: '',
  apiBaseUrl: ZE_API_ENDPOINT(),
  checkInterval: 30 * 60 * 1000, // 30 minutes
  minCheckInterval: 5 * 60 * 1000, // 5 minutes
  dismissDuration: 60 * 60 * 1000, // 1 hour
  checkOnForeground: true,
  enablePeriodicChecks: true,
  debug: false,
};

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
