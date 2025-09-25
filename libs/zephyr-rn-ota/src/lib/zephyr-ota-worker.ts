import { AppState, AppStateStatus } from 'react-native';
import type { OTAVersionResponse, OTACheckRequest } from 'zephyr-edge-contract';
import { fetchWithRetries } from 'zephyr-agent/src/lib/http/fetch-with-retries';
import type { ZephyrRuntimePluginInstance } from 'zephyr-xpack-internal';
import { ReactNativeBundleManager, RNUpdateStrategies } from './rn-bundle-manager';

export interface ZephyrOTAConfig {
  /** Application UID */
  applicationUid: string;
  /** OTA endpoint URL (will be provided by backend team) */
  otaEndpoint?: string;
  /** Check interval in milliseconds (default: 30 minutes) */
  checkInterval?: number;
  /** Retry attempts for failed checks (default: 3) */
  retryAttempts?: number;
  /** Enable debug logging */
  debug?: boolean;
}

export interface ZephyrOTAUpdate {
  /** New version available */
  version: string;
  /** Update description/release notes */
  description?: string;
  /** Whether this is a critical update */
  critical?: boolean;
  /** Manifest URL for the new version */
  manifestUrl: string;
  /** Timestamp of the update */
  timestamp: string;
}

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

interface StoredVersionInfo {
  version: string;
  timestamp: string;
  lastChecked: number;
}

const STORAGE_KEYS = {
  CURRENT_VERSION: 'zephyr_ota_current_version',
  LAST_CHECK: 'zephyr_ota_last_check',
  UPDATE_DECLINED: 'zephyr_ota_declined_updates',
} as const;

export class ZephyrOTAWorker {
  private config: Required<ZephyrOTAConfig>;
  private callbacks: ZephyrOTACallbacks;
  private runtimePlugin?: ZephyrRuntimePluginInstance;
  private bundleManager: ReactNativeBundleManager;
  private checkTimer?: NodeJS.Timeout;
  private isActive = false;
  private appStateListener?: any;

  constructor(config: ZephyrOTAConfig, callbacks: ZephyrOTACallbacks = {}) {
    this.config = {
      otaEndpoint: config.otaEndpoint || this.getMockEndpoint(config.applicationUid),
      checkInterval: config.checkInterval || 30 * 60 * 1000, // 30 minutes
      retryAttempts: config.retryAttempts || 3,
      debug: config.debug || false,
      applicationUid: config.applicationUid,
    };
    this.callbacks = callbacks;
    this.bundleManager = ReactNativeBundleManager.getInstance();

    // Register globally for transformer to find
    this.registerGlobally();

    this.log('OTA Worker initialized', {
      ...this.config,
      environment: this.bundleManager.getEnvironmentInfo(),
    });
  }

  /** Register worker globally so injected code can find it */
  private registerGlobally(): void {
    const global = this.getGlobalObject();
    global.__ZEPHYR_OTA_WORKER_CLASS__ = ZephyrOTAWorker;
    global.__ZEPHYR_BUNDLE_MANAGER__ = this.bundleManager;

    // Register restart handler
    global.__ZEPHYR_OTA_RESTART_REQUIRED__ = (manifest?: any) => {
      this.handleRestartRequired(manifest);
    };
  }

  private handleRestartRequired(manifest?: any): void {
    this.log('App restart required for update', manifest);

    // Notify via callback
    this.callbacks.onUpdateFailed?.(
      new Error('App restart required - this update requires a full app restart')
    );

    // Could show a different UI for restart-required updates
    // For now, we treat it as an update that needs user action
  }

  private getGlobalObject(): any {
    if (typeof globalThis !== 'undefined') return globalThis;
    if (typeof global !== 'undefined') return global;
    if (typeof window !== 'undefined') return window;
    return {};
  }

  /** Mock endpoint until backend team provides real one */
  private getMockEndpoint(applicationUid: string): string {
    return `https://mock-ota-api.zephyr-cloud.io/api/v1/ota/${applicationUid}/version`;
  }

  /** Set the runtime plugin instance for manifest updates */
  setRuntimePlugin(plugin: ZephyrRuntimePluginInstance): void {
    this.runtimePlugin = plugin;
  }

  /** Start the OTA worker */
  start(): void {
    if (this.isActive) {
      this.log('OTA Worker already active');
      return;
    }

    this.isActive = true;
    this.log('Starting OTA Worker');

    // Listen to app state changes
    this.appStateListener = AppState.addEventListener(
      'change',
      this.handleAppStateChange
    );

    // Perform initial check if app is active
    if (AppState.currentState === 'active') {
      this.performUpdateCheck();
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

  /** Handle app state changes */
  private handleAppStateChange = (nextAppState: AppStateStatus): void => {
    if (nextAppState === 'active' && this.isActive) {
      this.log('App became active, checking for updates');
      this.performUpdateCheck();
    }
  };

  /** Schedule the next update check */
  private scheduleNextCheck(): void {
    if (!this.isActive) return;

    if (this.checkTimer) {
      clearTimeout(this.checkTimer);
    }

    this.checkTimer = setTimeout(() => {
      if (this.isActive && AppState.currentState === 'active') {
        this.performUpdateCheck();
      }
      this.scheduleNextCheck();
    }, this.config.checkInterval);
  }

  /** Perform update check with retries */
  private async performUpdateCheck(): Promise<void> {
    try {
      await this.checkForUpdatesWithRetry();
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown OTA check error');
      this.log('Update check failed after all retries', err);
      this.callbacks.onUpdateError?.(err);
    }
  }

  /** Check for updates with retry logic */
  private async checkForUpdatesWithRetry(): Promise<void> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        await this.checkForUpdates();
        return; // Success, exit retry loop
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        this.log(`Update check attempt ${attempt} failed:`, lastError);

        if (attempt < this.config.retryAttempts) {
          // Exponential backoff: 1s, 2s, 4s, etc.
          const delay = Math.pow(2, attempt - 1) * 1000;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  /** Check for updates from the OTA endpoint */
  private async checkForUpdates(): Promise<void> {
    const currentVersion = await this.getCurrentVersion();

    const request: OTACheckRequest = {
      application_uid: this.config.applicationUid,
      current_version: currentVersion?.version,
      current_timestamp: currentVersion?.timestamp,
    };

    this.log('Checking for updates', request);

    // For now, mock the response since the real endpoint doesn't exist yet
    const response = await this.mockOTACheck(request);

    if (response && currentVersion) {
      const hasUpdate =
        response.timestamp !== currentVersion.timestamp ||
        response.version !== currentVersion.version;

      if (hasUpdate && !(await this.isUpdateDeclined(response.version))) {
        const update: ZephyrOTAUpdate = {
          version: response.version,
          description: response.description,
          critical: response.critical,
          manifestUrl: response.manifest_url,
          timestamp: response.timestamp,
        };

        this.log('Update available', update);
        this.callbacks.onUpdateAvailable?.(update);
      } else {
        this.log('No updates available or update declined');
      }
    }

    // Update last check time
    const { rnStorage } = await import('./rn-storage');
    await rnStorage.setItem(STORAGE_KEYS.LAST_CHECK, Date.now().toString());
  }

  /** Apply an available update using React Native-aware strategy */
  async applyUpdate(update: ZephyrOTAUpdate): Promise<void> {
    if (!this.runtimePlugin) {
      throw new Error('Runtime plugin not set. Call setRuntimePlugin() first.');
    }

    try {
      this.log('Applying update with RN-aware strategy', update);

      // Get current manifest to compare
      const currentManifest = await this.runtimePlugin.getCurrentManifest();

      // Create new manifest structure (simplified for this implementation)
      const newManifest = {
        version: update.version,
        timestamp: update.timestamp,
        manifest_url: update.manifestUrl,
        dependencies: {}, // Would be populated from actual manifest
      };

      // Determine update strategy based on RN environment
      const strategy = await this.bundleManager.determineUpdateStrategy(
        currentManifest,
        newManifest
      );

      this.log('Update strategy determined', {
        type: strategy.type,
        reason: strategy.reason,
      });

      // Execute the appropriate update strategy
      await strategy.action();

      // Store the new version info using storage abstraction
      const { rnStorage } = await import('./rn-storage');
      const versionInfo: StoredVersionInfo = {
        version: update.version,
        timestamp: update.timestamp,
        lastChecked: Date.now(),
      };
      await rnStorage.setItem(STORAGE_KEYS.CURRENT_VERSION, JSON.stringify(versionInfo));

      // Clear any declined updates
      await rnStorage.removeItem(STORAGE_KEYS.UPDATE_DECLINED);

      this.log('Update applied successfully', { strategy: strategy.type });
      this.callbacks.onUpdateApplied?.(update.version);
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown update error');
      this.log('Failed to apply update', err);
      this.callbacks.onUpdateFailed?.(err);
      throw err;
    }
  }

  /** Decline an update (won't be offered again for this version) */
  async declineUpdate(version: string): Promise<void> {
    const declined = await this.getDeclinedUpdates();
    declined.add(version);
    const { rnStorage } = await import('./rn-storage');
    await rnStorage.setItem(STORAGE_KEYS.UPDATE_DECLINED, JSON.stringify([...declined]));
    this.log('Update declined', version);
  }

  /** Get current version info from storage */
  private async getCurrentVersion(): Promise<StoredVersionInfo | null> {
    try {
      const { rnStorage } = await import('./rn-storage');
      const stored = await rnStorage.getItem(STORAGE_KEYS.CURRENT_VERSION);
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
      const { rnStorage } = await import('./rn-storage');
      const stored = await rnStorage.getItem(STORAGE_KEYS.UPDATE_DECLINED);
      const array = stored ? JSON.parse(stored) : [];
      return new Set(array);
    } catch {
      return new Set();
    }
  }

  /** Mock OTA endpoint response (remove when real endpoint is ready) */
  private async mockOTACheck(
    request: OTACheckRequest
  ): Promise<OTAVersionResponse | null> {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 500 + Math.random() * 1000));

    // Mock: 20% chance of having an update available
    const hasUpdate = Math.random() < 0.2;

    if (!hasUpdate && request.current_version) {
      return null; // No update available
    }

    // Mock response with new version
    const mockVersion = request.current_version
      ? this.incrementVersion(request.current_version)
      : '1.0.0';

    return {
      version: mockVersion,
      timestamp: new Date().toISOString(),
      manifest_url: `https://cdn.zephyr-cloud.io/${this.config.applicationUid}/${mockVersion}/zephyr-manifest.json`,
      description: `Update to version ${mockVersion} with bug fixes and improvements`,
      critical: Math.random() < 0.1, // 10% chance of critical update
    };
  }

  /** Simple version incrementer for mocking */
  private incrementVersion(version: string): string {
    const parts = version.split('.').map((n) => parseInt(n));
    parts[2] += 1; // Increment patch version
    return parts.join('.');
  }

  /** Debug logging */
  private log(message: string, data?: any): void {
    if (this.config.debug) {
      console.log(`[ZephyrOTA] ${message}`, data || '');
    }
  }
}
