import type { ZephyrOTAConfig, RemoteVersionInfo, UpdateCheckResult } from '../types';

/** Context value type for ZephyrOTA */
export interface ZephyrOTAContextValue {
  /** Whether an update check is in progress */
  isChecking: boolean;

  /** Whether updates are available */
  hasUpdates: boolean;

  /** List of remotes with updates available */
  updates: RemoteVersionInfo[];

  /** All tracked remotes and their version info */
  remotes: RemoteVersionInfo[];

  /** When the last update check occurred */
  lastChecked: Date | null;

  /** Any error that occurred during update check */
  error: Error | null;

  /** Manually trigger an update check */
  checkForUpdates: (options?: { force?: boolean }) => Promise<UpdateCheckResult>;

  /** Apply available updates (will reload the app) */
  applyUpdates: () => Promise<void>;

  /** Dismiss update prompts for the configured duration */
  dismissUpdates: () => Promise<void>;

  /** Get version info for a specific remote */
  getRemoteVersion: (remoteName: string) => RemoteVersionInfo | undefined;
}

/**
 * Props for ZephyrOTAProvider
 *
 * @example
 *   Basic usage with host URL
 *   ```tsx
 *   <ZephyrOTAProvider config={{ hostUrl: 'https://myapp.zephyrcloud.app' }}>
 *     <App />
 *   </ZephyrOTAProvider>
 *   ```
 *
 * @example
 *   With all options
 *   ```tsx
 *   <ZephyrOTAProvider
 *     config={{
 *       hostUrl: 'https://myapp.zephyrcloud.app',
 *       checkInterval: 60000, // 1 minute
 *       debug: true,
 *     }}
 *     onUpdateAvailable={(updates) => console.log('Updates:', updates)}
 *     onError={(error) => console.error('OTA Error:', error)}
 *   >
 *     <App />
 *   </ZephyrOTAProvider>
 *   ```
 */
export interface ZephyrOTAProviderProps {
  /** Child components */
  children: React.ReactNode;

  /**
   * OTA configuration. The `hostUrl` field is required - this is the deployed URL where your
   * app's zephyr-manifest.json is served.
   *
   * @example
   *   ```tsx
   *   config={{ hostUrl: 'https://myapp.zephyrcloud.app' }}
   *   ```
   */
  config: ZephyrOTAConfig;

  /** Called when updates are available */
  onUpdateAvailable?: (updates: RemoteVersionInfo[]) => void;

  /** Called after updates are applied (before reload) */
  onUpdateApplied?: () => void;

  /** Called when an error occurs */
  onError?: (error: Error) => void;
}
