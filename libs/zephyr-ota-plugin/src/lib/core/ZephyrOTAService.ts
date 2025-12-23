import { NativeModules } from 'react-native';
import { getInstance } from '@module-federation/runtime';
import type {
  ZephyrOTAConfig,
  RemoteVersionInfo,
  UpdateCheckResult,
  StoredVersions,
  ZephyrManifest,
} from '../types';
import { DEFAULT_OTA_CONFIG } from '../types';
import { ZephyrAPIClient } from './api-client';
import { OTAStorage } from './storage';
import { setDebugEnabled, createScopedLogger } from '../utils/logger';

const logger = createScopedLogger('Service');

// Get DevSettings for app reload functionality
const { DevSettings } = NativeModules;

/** Listener function type for update events */
export type UpdateListener = (result: UpdateCheckResult) => void;

/**
 * Main OTA service that orchestrates update checking and application using manifest-based
 * flow
 */
export class ZephyrOTAService {
  private static instance: ZephyrOTAService | null = null;

  private readonly config: Required<Omit<ZephyrOTAConfig, 'onStorageError'>> & {
    onStorageError?: ZephyrOTAConfig['onStorageError'];
  };
  private readonly apiClient: ZephyrAPIClient;
  private readonly storage: OTAStorage;

  private cachedManifest: ZephyrManifest | null = null;
  private periodicCheckInterval: ReturnType<typeof setInterval> | null = null;
  private listeners: Set<UpdateListener> = new Set();
  private lastCheckTime = 0;
  private isInitialized = false;

  constructor(config: ZephyrOTAConfig) {
    // Validate required config
    if (!config.hostUrl) {
      // eslint-disable-next-line no-restricted-syntax
      throw new Error('ZephyrOTAService requires hostUrl to be configured');
    }

    // Merge with defaults
    this.config = {
      ...DEFAULT_OTA_CONFIG,
      ...config,
    };

    // Initialize components
    this.apiClient = new ZephyrAPIClient(this.config);
    this.storage = new OTAStorage(this.config);

    // Set debug logging
    setDebugEnabled(this.config.debug);

    logger.debug('Service created with config:', {
      hostUrl: this.config.hostUrl,
      manifestPath: this.config.manifestPath,
    });
  }

  /** Get or create singleton instance */
  static getInstance(config: ZephyrOTAConfig): ZephyrOTAService {
    if (!ZephyrOTAService.instance) {
      ZephyrOTAService.instance = new ZephyrOTAService(config);
    }
    return ZephyrOTAService.instance;
  }

  /** Reset singleton instance (useful for testing) */
  static resetInstance(): void {
    if (ZephyrOTAService.instance) {
      ZephyrOTAService.instance.stopPeriodicChecks();
      ZephyrOTAService.instance = null;
    }
  }

  /**
   * Initialize version tracking by fetching manifest and storing current versions. This
   * should be called on first launch to establish the baseline versions.
   */
  async initializeVersionTracking(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    logger.info('Initializing version tracking from manifest...');

    // Fetch manifest from host URL
    const manifestResult = await this.apiClient.fetchManifest();
    if (!manifestResult) {
      logger.error('Failed to fetch manifest - version tracking disabled');
      return;
    }

    this.cachedManifest = manifestResult.manifest;
    const dependencyCount = Object.keys(this.cachedManifest.dependencies || {}).length;
    logger.debug(`Manifest loaded with ${dependencyCount} dependencies`);

    // Check if we have stored versions
    const storedVersions = await this.storage.getStoredVersions();
    const hasValidVersions = Object.values(storedVersions).some(
      (v) => v.version !== undefined && v.version !== null
    );

    // If we already have valid versions stored, skip initialization
    if (Object.keys(storedVersions).length > 0 && hasValidVersions) {
      logger.debug('Already have valid stored versions, skipping initialization');
      this.isInitialized = true;
      return;
    }

    // Clear invalid stored versions
    if (Object.keys(storedVersions).length > 0 && !hasValidVersions) {
      logger.debug('Clearing invalid stored versions (missing version field)');
      await this.storage.saveVersions({});
    }

    // First launch: store versions from manifest
    logger.info('First launch - storing versions from manifest');
    const newVersions: StoredVersions = {};

    for (const [name, dep] of Object.entries(this.cachedManifest.dependencies || {})) {
      newVersions[name] = {
        version: dep.snapshot_id ?? dep.remote_entry_url,
        url: dep.remote_entry_url,
        lastUpdated: Date.now(),
        publishedAt: dep.published_at,
      };
      logger.debug(
        `Initial version for ${name}: ${dep.snapshot_id ?? dep.remote_entry_url} (published_at: ${dep.published_at})`
      );
    }

    await this.storage.saveVersions(newVersions);
    logger.info('Version tracking initialized with manifest versions');
    this.isInitialized = true;
  }

  /** Check if we can perform an update check (rate limiting) */
  private canCheck(): boolean {
    const now = Date.now();
    return now - this.lastCheckTime >= this.config.minCheckInterval;
  }

  /**
   * Check all remotes for updates by comparing manifest versions with live
   * __get_version_info__
   *
   * @param force - If true, bypasses rate limiting
   * @returns Update check result
   */
  async checkForUpdates(force = false): Promise<UpdateCheckResult> {
    logger.debug('checkForUpdates called, force:', force);

    // Rate limiting check
    if (!force && !this.canCheck()) {
      logger.debug('Skipping check (rate limited)');
      return {
        hasUpdates: false,
        remotes: [],
        timestamp: Date.now(),
      };
    }

    this.lastCheckTime = Date.now();

    // Ensure manifest is loaded (fetch fresh if not cached)
    if (!this.cachedManifest) {
      const manifestResult = await this.apiClient.fetchManifest();
      if (!manifestResult) {
        logger.error('Failed to fetch manifest');
        return { hasUpdates: false, remotes: [], timestamp: Date.now() };
      }
      this.cachedManifest = manifestResult.manifest;
    }

    const dependencies = this.cachedManifest.dependencies || {};
    logger.debug(`Checking ${Object.keys(dependencies).length} dependencies for updates...`);

    // Check each dependency for updates using __get_version_info__
    const versionChecks = await this.apiClient.checkDependenciesForUpdates(dependencies);

    // Get stored versions for comparison
    const storedVersions = await this.storage.getStoredVersions();

    // Build RemoteVersionInfo array
    const remotes: RemoteVersionInfo[] = [];
    for (const [name, check] of versionChecks) {
      const dep = dependencies[name];
      const stored = storedVersions[name] ?? null;

      const remoteInfo: RemoteVersionInfo = {
        name,
        currentVersion: stored?.version ?? check.pinnedVersion.snapshot_id ?? null,
        latestVersion: check.latestVersion?.snapshot_id ?? dep.remote_entry_url,
        remoteEntryUrl: dep.remote_entry_url,
        hasUpdate: check.hasUpdate,
        publishedAt: check.latestVersion?.published_at,
      };

      logger.debug(`Version comparison for ${name}:`, {
        currentVersion: remoteInfo.currentVersion,
        latestVersion: remoteInfo.latestVersion,
        hasUpdate: remoteInfo.hasUpdate,
      });

      remotes.push(remoteInfo);
    }

    // Save last check time
    await this.storage.setLastCheckTime(Date.now());

    const result: UpdateCheckResult = {
      hasUpdates: remotes.some((r) => r.hasUpdate),
      remotes,
      timestamp: Date.now(),
    };

    logger.debug('Final check result:', {
      hasUpdates: result.hasUpdates,
      remotes: result.remotes.map((r) => ({
        name: r.name,
        current: r.currentVersion,
        latest: r.latestVersion,
        hasUpdate: r.hasUpdate,
      })),
    });

    // Notify listeners
    this.notifyListeners(result);

    return result;
  }

  /**
   * Apply updates by clearing caches and reloading the app
   *
   * @param updates - Remotes to update
   */
  async applyUpdates(updates: RemoteVersionInfo[]): Promise<void> {
    const updatesToApply = updates.filter((u) => u.hasUpdate);
    if (updatesToApply.length === 0) {
      logger.debug('No updates to apply');
      return;
    }

    logger.info(
      'Applying updates for:',
      updatesToApply.map((u) => u.name)
    );

    // Clear Module Federation caches
    const federationHost = getInstance();

    // Internal MF host types for cache clearing (not publicly typed)
    interface MFHostInternal {
      snapshotHandler?: { manifestCache?: Map<string, unknown> };
      moduleCache?: Map<string, unknown>;
    }

    for (const update of updatesToApply) {
      logger.debug(
        `Applying update for ${update.name}: ${update.currentVersion} -> ${update.latestVersion}`
      );

      try {
        if (federationHost) {
          const host = federationHost as unknown as MFHostInternal;

          // Clear manifest cache if available
          if (host.snapshotHandler?.manifestCache) {
            host.snapshotHandler.manifestCache.delete(update.name);
          }

          // Clear module cache entries for this remote
          if (host.moduleCache) {
            for (const key of host.moduleCache.keys()) {
              if (key.startsWith(update.name)) {
                host.moduleCache.delete(key);
              }
            }
          }
        }
      } catch (error) {
        logger.warn(`Error clearing cache for ${update.name}:`, error);
      }
    }

    // Update stored versions
    const storedVersions = await this.storage.getStoredVersions();
    for (const update of updatesToApply) {
      storedVersions[update.name] = {
        version: update.latestVersion,
        url: update.remoteEntryUrl,
        lastUpdated: Date.now(),
        publishedAt: update.publishedAt,
      };
    }
    await this.storage.saveVersions(storedVersions);

    // Clear manifest cache to force re-fetch
    this.cachedManifest = null;

    // Clear dismiss state so user sees new updates in future
    await this.storage.clearDismiss();

    logger.info('Updates applied successfully, reloading app...');

    // Reload the app to apply the new remote versions
    this.reloadApp();
  }

  /** Reload the app to apply updates */
  private reloadApp(): void {
    if (DevSettings && typeof DevSettings.reload === 'function') {
      // Small delay to ensure state is persisted before reload
      setTimeout(() => {
        DevSettings.reload();
      }, 100);
    } else {
      logger.warn('DevSettings.reload not available, app reload may not work');
    }
  }

  /** Dismiss update prompts for the configured duration */
  async dismiss(): Promise<void> {
    await this.storage.dismiss();
    logger.debug('Updates dismissed');
  }

  /** Check if updates are currently dismissed */
  async isDismissed(): Promise<boolean> {
    return this.storage.isDismissed();
  }

  /** Start periodic update checks */
  startPeriodicChecks(): void {
    if (!this.config.enablePeriodicChecks) {
      logger.debug('Periodic checks disabled');
      return;
    }

    if (this.periodicCheckInterval) {
      logger.debug('Periodic checks already running');
      return;
    }

    const intervalMinutes = this.config.checkInterval / 1000 / 60;
    logger.info(`Starting periodic checks every ${intervalMinutes} minutes`);

    this.periodicCheckInterval = setInterval(() => {
      void this.checkForUpdates(false);
    }, this.config.checkInterval);
  }

  /** Stop periodic update checks */
  stopPeriodicChecks(): void {
    if (this.periodicCheckInterval) {
      clearInterval(this.periodicCheckInterval);
      this.periodicCheckInterval = null;
      logger.info('Stopped periodic checks');
    }
  }

  /**
   * Subscribe to update events
   *
   * @param listener - Callback function for update events
   * @returns Unsubscribe function
   */
  onUpdateAvailable(listener: UpdateListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Notify all listeners of update check results */
  private notifyListeners(result: UpdateCheckResult): void {
    for (const listener of this.listeners) {
      try {
        listener(result);
      } catch (error) {
        logger.warn('Error in listener:', error);
      }
    }
  }

  /** Get the storage instance (for advanced use cases) */
  getStorage(): OTAStorage {
    return this.storage;
  }

  /** Get the API client instance (for advanced use cases) */
  getAPIClient(): ZephyrAPIClient {
    return this.apiClient;
  }

  /** Get the cached manifest (null if not yet fetched) */
  getCachedManifest(): ZephyrManifest | null {
    return this.cachedManifest;
  }

  /** Force refresh the manifest cache */
  async refreshManifest(): Promise<ZephyrManifest | null> {
    const manifestResult = await this.apiClient.fetchManifest();
    if (manifestResult) {
      this.cachedManifest = manifestResult.manifest;
    }
    return this.cachedManifest;
  }
}
