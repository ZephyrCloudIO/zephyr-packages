import type {
  OTACheckRequest,
  OTAVersionResponse,
  ZephyrRuntimePluginInstance,
} from 'zephyr-edge-contract';
import { fetchWithRetries } from '../http/fetch-with-retries';
import { ze_log } from '../logging';
import { ZephyrError, ZeErrors } from '../errors';

/** Configuration for the Zephyr OTA Worker */
export interface ZephyrOTAConfig {
  /** Application UID */
  applicationUid: string;
  /** OTA endpoint URL */
  otaEndpoint?: string;
  /** Check interval in milliseconds (default: 30 minutes) */
  checkInterval?: number;
  /** Retry attempts for failed checks (default: 3) */
  retryAttempts?: number;
  /** Enable debug logging */
  debug?: boolean;
  /** Platform identifier */
  platform?: 'ios' | 'android';
}

/** OTA update information */
export interface ZephyrOTAUpdate {
  version: string;
  description?: string;
  critical?: boolean;
  manifestUrl: string;
  timestamp: string;
  releaseNotes?: string;
}

/** Callbacks for OTA events */
export interface ZephyrOTACallbacks {
  /** Called when a new update is available */
  onUpdateAvailable?: (update: ZephyrOTAUpdate) => void;
  /** Called when update check fails */
  onUpdateError?: (error: Error) => void;
  /** Called when update is applied successfully */
  onUpdateApplied?: (version: string) => void;
  /** Called when update application fails */
  onUpdateFailed?: (error: Error) => void;
}

/** Stored version information in AsyncStorage */
interface StoredVersionInfo {
  version: string;
  timestamp: string;
  lastChecked: number;
}

/** OTA telemetry metrics */
interface OTAMetrics {
  checksPerformed: number;
  updatesAvailable: number;
  updatesApplied: number;
  updatesFailed: number;
  lastCheckTimestamp: number;
  lastUpdateTimestamp?: number;
}

/** Storage keys for AsyncStorage */
const STORAGE_KEYS = {
  CURRENT_VERSION: 'zephyr_ota_current_version',
  LAST_CHECK: 'zephyr_ota_last_check',
  UPDATE_DECLINED: 'zephyr_ota_declined_updates',
  METRICS: 'zephyr_ota_metrics',
} as const;

/**
 * React Native OTA Worker for Zephyr
 *
 * Features:
 *
 * - Polls OTA endpoint using fetchWithRetries
 * - De-dupes work using AsyncStorage for manifest hash storage
 * - Pauses polling in background, resumes on foreground
 * - Integrates with runtime plugin for refresh calls
 * - Provides typed event callbacks
 */
export class ZephyrOTAWorker {
  private config: Required<ZephyrOTAConfig>;
  private callbacks: ZephyrOTACallbacks;
  private runtimePlugin?: ZephyrRuntimePluginInstance;
  private checkTimer?: NodeJS.Timeout;
  private isActive = false;
  private appStateListener?: any;
  private metrics: OTAMetrics = {
    checksPerformed: 0,
    updatesAvailable: 0,
    updatesApplied: 0,
    updatesFailed: 0,
    lastCheckTimestamp: 0,
  };

  constructor(config: ZephyrOTAConfig, callbacks: ZephyrOTACallbacks = {}) {
    this.config = {
      otaEndpoint: config.otaEndpoint || this.getDefaultEndpoint(config.applicationUid),
      checkInterval: config.checkInterval || 30 * 60 * 1000, // 30 minutes
      retryAttempts: config.retryAttempts || 3,
      debug: config.debug || false,
      platform: config.platform || 'android',
      applicationUid: config.applicationUid,
    };
    this.callbacks = callbacks;

    // Register globally for runtime access
    this.registerGlobally();

    this.log('OTA Worker initialized', {
      applicationUid: this.config.applicationUid,
      checkInterval: this.config.checkInterval,
      platform: this.config.platform,
    });
  }

  /** Register worker globally so bundler plugins can access it */
  private registerGlobally(): void {
    const global = this.getGlobalObject();
    global.__ZEPHYR_OTA_WORKER__ = this;
    global.__ZEPHYR_OTA_WORKER_CLASS__ = ZephyrOTAWorker;
  }

  private getGlobalObject(): any {
    if (typeof globalThis !== 'undefined') return globalThis;
    if (typeof global !== 'undefined') return global;
    if (typeof window !== 'undefined') return window;
    return {};
  }

  /** Default OTA endpoint URL */
  private getDefaultEndpoint(applicationUid: string): string {
    return `https://api.zephyr-cloud.io/v1/ota/${applicationUid}/version`;
  }

  /** Set the runtime plugin instance for manifest refresh */
  setRuntimePlugin(plugin: ZephyrRuntimePluginInstance): void {
    this.runtimePlugin = plugin;
    this.log('Runtime plugin connected');
  }

  /** Start the OTA worker */
  async start(): Promise<void> {
    if (this.isActive) {
      this.log('OTA Worker already active');
      return;
    }

    this.isActive = true;
    this.log('Starting OTA Worker');

    // Listen to app state changes (React Native specific)
    if (this.isReactNative()) {
      const { AppState } = await this.getReactNative();
      this.appStateListener = AppState.addEventListener(
        'change',
        this.handleAppStateChange
      );

      // Perform initial check if app is active
      if (AppState.currentState === 'active') {
        void this.performUpdateCheck();
      }
    } else {
      // Non-RN environment, perform immediate check
      void this.performUpdateCheck();
    }

    // Set up periodic checks
    this.scheduleNextCheck();
  }

  /** Stop the OTA worker */
  stop(): void {
    if (!this.isActive) return;

    this.log('Stopping OTA Worker');
    this.isActive = false;

    if (this.checkTimer) {
      clearTimeout(this.checkTimer);
      this.checkTimer = undefined;
    }

    if (this.appStateListener) {
      this.appStateListener.remove();
      this.appStateListener = undefined;
    }
  }

  /** Handle React Native app state changes */
  private handleAppStateChange = (nextAppState: string): void => {
    if (nextAppState === 'active' && this.isActive) {
      this.log('App became active, checking for updates');
      void this.performUpdateCheck();
    }
  };

  /** Schedule the next update check */
  private scheduleNextCheck(): void {
    if (!this.isActive) return;

    if (this.checkTimer) {
      clearTimeout(this.checkTimer);
    }

    this.checkTimer = setTimeout(() => {
      void (async () => {
        if (this.isActive) {
          // In RN, only check if app is active
          if (this.isReactNative()) {
            const { AppState } = await this.getReactNative();
            if (AppState.currentState === 'active') {
              void this.performUpdateCheck();
            }
          } else {
            void this.performUpdateCheck();
          }
        }
        this.scheduleNextCheck();
      })();
    }, this.config.checkInterval);
  }

  /** Perform update check with retry logic */
  private async performUpdateCheck(): Promise<void> {
    try {
      await this.updateMetrics('check');
      await this.checkForUpdatesWithRetry();
    } catch (error) {
      const err =
        error instanceof Error
          ? error
          : new ZephyrError(ZeErrors.ERR_UNKNOWN, {
              message: 'Unknown OTA check error',
            });
      this.log('Update check failed after all retries', err.message);
      this.callbacks.onUpdateError?.(err);
    }
  }

  /** Check for updates with retry logic using fetchWithRetries */
  private async checkForUpdatesWithRetry(): Promise<void> {
    const currentVersion = await this.getCurrentVersion();

    const request: OTACheckRequest = {
      application_uid: this.config.applicationUid,
      current_version: currentVersion?.version,
      current_timestamp: currentVersion?.timestamp,
      platform: this.config.platform,
    };

    this.log('Checking for updates', request);

    // Use Zephyr's retry helper for consistent behavior
    const response = await fetchWithRetries(
      new URL(this.config.otaEndpoint),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      },
      this.config.retryAttempts
    );

    const data: OTAVersionResponse = await response.json();

    if (data && currentVersion) {
      const hasUpdate =
        data.timestamp !== currentVersion.timestamp ||
        data.version !== currentVersion.version;

      if (hasUpdate && !(await this.isUpdateDeclined(data.version))) {
        const update: ZephyrOTAUpdate = {
          version: data.version,
          description: data.description,
          critical: data.critical,
          manifestUrl: data.manifest_url,
          timestamp: data.timestamp,
          releaseNotes: data.release_notes,
        };

        this.log('Update available', update);
        await this.updateMetrics('update_available');
        this.callbacks.onUpdateAvailable?.(update);
      } else {
        this.log('No updates available or update declined');
      }
    }

    // Update last check time
    await this.setStorageItem(STORAGE_KEYS.LAST_CHECK, Date.now().toString());
  }

  /** Apply an available update */
  async applyUpdate(update: ZephyrOTAUpdate): Promise<void> {
    if (!this.runtimePlugin) {
      throw new ZephyrError(ZeErrors.ERR_UNKNOWN, {
        message: 'Runtime plugin not set. Call setRuntimePlugin() first.',
      });
    }

    try {
      this.log('Applying update', update);

      // Call runtime plugin refresh to fetch new manifest
      await this.runtimePlugin.refresh();

      // Store the new version info
      const versionInfo: StoredVersionInfo = {
        version: update.version,
        timestamp: update.timestamp,
        lastChecked: Date.now(),
      };
      await this.setStorageItem(
        STORAGE_KEYS.CURRENT_VERSION,
        JSON.stringify(versionInfo)
      );

      // Clear any declined updates
      await this.removeStorageItem(STORAGE_KEYS.UPDATE_DECLINED);

      this.log('Update applied successfully');
      await this.updateMetrics('update_applied');
      this.callbacks.onUpdateApplied?.(update.version);
    } catch (error) {
      const err =
        error instanceof Error
          ? error
          : new ZephyrError(ZeErrors.ERR_UNKNOWN, {
              message: 'Unknown update error',
            });
      this.log('Failed to apply update', err.message);
      await this.updateMetrics('update_failed');
      this.callbacks.onUpdateFailed?.(err);
      throw err;
    }
  }

  /** Decline an update (won't be offered again for this version) */
  async declineUpdate(version: string): Promise<void> {
    const declined = await this.getDeclinedUpdates();
    declined.add(version);
    await this.setStorageItem(
      STORAGE_KEYS.UPDATE_DECLINED,
      JSON.stringify([...declined])
    );
    this.log('Update declined', version);
  }

  /** Get current version info from storage */
  private async getCurrentVersion(): Promise<StoredVersionInfo | null> {
    try {
      const stored = await this.getStorageItem(STORAGE_KEYS.CURRENT_VERSION);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }

  /** Check if an update version has been declined */
  private async isUpdateDeclined(version: string): Promise<boolean> {
    const declined = await this.getDeclinedUpdates();
    return declined.has(version);
  }

  /** Get set of declined update versions */
  private async getDeclinedUpdates(): Promise<Set<string>> {
    try {
      const stored = await this.getStorageItem(STORAGE_KEYS.UPDATE_DECLINED);
      const array = stored ? JSON.parse(stored) : [];
      return new Set(array);
    } catch {
      return new Set();
    }
  }

  /** Check if running in React Native environment */
  private isReactNative(): boolean {
    return typeof navigator !== 'undefined' && navigator.product === 'ReactNative';
  }

  /** Get React Native modules */
  private async getReactNative(): Promise<any> {
    if (this.isReactNative()) {
      // Dynamic import to avoid issues in non-RN environments
      // @ts-expect-error - react-native is an optional peer dependency
      return await import('react-native');
    }
    throw new ZephyrError(ZeErrors.ERR_UNKNOWN, {
      message: 'Not running in React Native environment',
    });
  }

  /** Storage abstraction - works with AsyncStorage in RN or localStorage in web */
  private async getStorageItem(key: string): Promise<string | null> {
    if (this.isReactNative()) {
      try {
        // Dynamic import with string literal to avoid build-time TypeScript errors
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore - @react-native-async-storage/async-storage is an optional peer dependency
        const AsyncStorageModule = await import(
          '@react-native-async-storage/async-storage'
        );
        const AsyncStorage = AsyncStorageModule.default || AsyncStorageModule;
        return AsyncStorage.getItem(key);
      } catch {
        return null;
      }
    } else if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
    return null;
  }

  private async setStorageItem(key: string, value: string): Promise<void> {
    if (this.isReactNative()) {
      try {
        // Dynamic import with string literal to avoid build-time TypeScript errors
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore - @react-native-async-storage/async-storage is an optional peer dependency
        const AsyncStorageModule = await import(
          '@react-native-async-storage/async-storage'
        );
        const AsyncStorage = AsyncStorageModule.default || AsyncStorageModule;
        await AsyncStorage.setItem(key, value);
      } catch {
        // Ignore storage errors
      }
    } else if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
    }
  }

  private async removeStorageItem(key: string): Promise<void> {
    if (this.isReactNative()) {
      try {
        // Dynamic import with string literal to avoid build-time TypeScript errors
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore - @react-native-async-storage/async-storage is an optional peer dependency
        const AsyncStorageModule = await import(
          '@react-native-async-storage/async-storage'
        );
        const AsyncStorage = AsyncStorageModule.default || AsyncStorageModule;
        await AsyncStorage.removeItem(key);
      } catch {
        // Ignore storage errors
      }
    } else if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key);
    }
  }

  /** Load metrics from storage */
  private async loadMetrics(): Promise<void> {
    try {
      const stored = await this.getStorageItem(STORAGE_KEYS.METRICS);
      if (stored) {
        this.metrics = { ...this.metrics, ...JSON.parse(stored) };
      }
    } catch {
      // Use default metrics
    }
  }

  /** Save metrics to storage */
  private async saveMetrics(): Promise<void> {
    try {
      await this.setStorageItem(STORAGE_KEYS.METRICS, JSON.stringify(this.metrics));
    } catch {
      // Ignore storage errors
    }
  }

  /** Update and log telemetry metrics */
  private async updateMetrics(
    type: 'check' | 'update_available' | 'update_applied' | 'update_failed'
  ): Promise<void> {
    switch (type) {
      case 'check':
        this.metrics.checksPerformed++;
        this.metrics.lastCheckTimestamp = Date.now();
        break;
      case 'update_available':
        this.metrics.updatesAvailable++;
        break;
      case 'update_applied':
        this.metrics.updatesApplied++;
        this.metrics.lastUpdateTimestamp = Date.now();
        break;
      case 'update_failed':
        this.metrics.updatesFailed++;
        break;
    }

    await this.saveMetrics();

    // Log telemetry via ze_log for observability
    ze_log.app('OTA metrics updated', {
      type,
      applicationUid: this.config.applicationUid,
      metrics: this.metrics,
    });
  }

  /** Get current metrics for debugging */
  getMetrics(): OTAMetrics {
    return { ...this.metrics };
  }

  /** Debug logging */
  private log(message: string, data?: any): void {
    if (this.config.debug) {
      console.log(`[ZephyrOTA] ${message}`, data || '');
    }
  }
}

/** React hook for OTA updates (React Native specific) */
export interface UseZephyrUpdatesOptions {
  worker: ZephyrOTAWorker;
  /** Auto-apply non-critical updates */
  autoApply?: boolean;
}

export interface UseZephyrUpdatesResult {
  /** Current update available (if any) */
  updateAvailable: ZephyrOTAUpdate | null;
  /** Whether an update is being applied */
  isApplying: boolean;
  /** Apply the available update */
  applyUpdate: () => Promise<void>;
  /** Decline the available update */
  declineUpdate: () => Promise<void>;
  /** Last error that occurred */
  error: Error | null;
}

/** React hook for managing OTA updates This should be used in React Native applications */
export function useZephyrUpdates(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _options: UseZephyrUpdatesOptions
): UseZephyrUpdatesResult {
  // This function should only be used in React environments
  // The actual implementation would depend on React hooks
  throw new ZephyrError(ZeErrors.ERR_UNKNOWN, {
    message:
      'useZephyrUpdates is a React hook and should only be used in React components. ' +
      'Please implement this hook in your React Native application.',
  });
}
