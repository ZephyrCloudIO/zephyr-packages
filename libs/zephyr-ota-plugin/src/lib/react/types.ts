import type {
  ZephyrOTAConfig,
  ZephyrDependencyConfig,
  RemoteVersionInfo,
  UpdateCheckResult,
} from '../types';
import type { EnvironmentOverrides } from '../utils/detect-remotes';

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

/** Props for ZephyrOTAProvider */
export interface ZephyrOTAProviderProps {
  /** Child components */
  children: React.ReactNode;

  /** OTA configuration (optional) */
  config?: ZephyrOTAConfig;

  /**
   * Target environment for OTA updates (e.g., 'staging', 'production'). When provided,
   * remotes are auto-detected from Module Federation runtime. This is the recommended
   * approach.
   *
   * @example
   *   ```tsx
   *   <ZephyrOTAProvider environment="staging">
   *     <App />
   *   </ZephyrOTAProvider>
   *   ```;
   */
  environment?: string;

  /**
   * Per-remote environment overrides. Use this when some remotes should use a different
   * environment than the default. Only used when `environment` prop is provided.
   *
   * @example
   *   ```tsx
   *   <ZephyrOTAProvider
   *     environment="staging"
   *     overrides={{ MFTextEditor: 'production' }}
   *   >
   *     <App />
   *   </ZephyrOTAProvider>
   *   ```;
   */
  overrides?: EnvironmentOverrides;

  /**
   * Manual dependencies configuration (legacy). Map of remote names to zephyr: protocol
   * strings. Use this only if auto-detection doesn't work for your setup.
   *
   * @deprecated Prefer using `environment` prop for auto-detection
   */
  dependencies?: ZephyrDependencyConfig;

  /** Called when updates are available */
  onUpdateAvailable?: (updates: RemoteVersionInfo[]) => void;

  /** Called after updates are applied (before reload) */
  onUpdateApplied?: () => void;

  /** Called when an error occurs */
  onError?: (error: Error) => void;
}
