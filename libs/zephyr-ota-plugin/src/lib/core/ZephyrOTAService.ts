import { NativeModules } from 'react-native';
import { getInstance } from '@module-federation/runtime';
import type {
  ZephyrOTAConfig,
  ZephyrDependencyConfig,
  RemoteVersionInfo,
  UpdateCheckResult,
  StoredVersions,
} from '../types';
import { DEFAULT_OTA_CONFIG } from '../types';
import { ZephyrAPIClient } from './api-client';
import { OTAStorage } from './storage';
import {
  createRemoteVersionInfo,
  createStoredVersionInfo,
  getRemotesWithUpdates,
} from './version-tracker';
import { parseZephyrDependencies } from '../utils/parse-dependencies';
import { setDebugEnabled, createScopedLogger } from '../utils/logger';

const logger = createScopedLogger('Service');

// Get DevSettings for app reload functionality
const { DevSettings } = NativeModules;

/** Listener function type for update events */
export type UpdateListener = (result: UpdateCheckResult) => void;

/** Main OTA service that orchestrates update checking and application */
export class ZephyrOTAService {
  private static instance: ZephyrOTAService | null = null;

  private readonly config: Required<ZephyrOTAConfig>;
  private readonly dependencies: ZephyrDependencyConfig;
  private readonly apiClient: ZephyrAPIClient;
  private readonly storage: OTAStorage;

  private periodicCheckInterval: ReturnType<typeof setInterval> | null = null;
  private listeners: Set<UpdateListener> = new Set();
  private lastCheckTime = 0;
  private isInitialized = false;

  constructor(config: ZephyrOTAConfig, dependencies: ZephyrDependencyConfig) {
    // Merge with defaults
    this.config = {
      ...DEFAULT_OTA_CONFIG,
      ...config,
    };
    this.dependencies = dependencies;

    // Initialize components
    this.apiClient = new ZephyrAPIClient(this.config);
    this.storage = new OTAStorage(this.config);

    // Set debug logging
    setDebugEnabled(this.config.debug);

    logger.debug('Service created with config:', this.config);
  }

  /** Get or create singleton instance */
  static getInstance(
    config: ZephyrOTAConfig,
    dependencies: ZephyrDependencyConfig
  ): ZephyrOTAService {
    if (!ZephyrOTAService.instance) {
      ZephyrOTAService.instance = new ZephyrOTAService(config, dependencies);
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
   * Initialize version tracking on first launch This stores the current versions so we
   * can detect future updates
   */
  async initializeVersionTracking(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    const storedVersions = await this.storage.getStoredVersions();
    logger.debug('initializeVersionTracking - stored versions:', storedVersions);

    // Check if stored versions are valid (have version field)
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

    logger.info('Initializing version tracking (first launch)...');

    // Fetch current versions from Zephyr using batch resolve
    const parsedDeps = parseZephyrDependencies(this.dependencies);
    const newVersions: StoredVersions = {};

    logger.debug(`Resolving initial versions for ${parsedDeps.length} dependencies...`);
    const resolvedMap = await this.apiClient.resolveRemotesBatch(parsedDeps);

    for (const dep of parsedDeps) {
      const resolved = resolvedMap.get(dep.name) ?? null;
      if (resolved) {
        newVersions[dep.name] = createStoredVersionInfo(resolved);
        logger.debug(
          `Initial version for ${dep.name}: ${resolved.version} (published_at: ${resolved.published_at})`
        );
      } else {
        logger.debug(`Failed to resolve initial version for ${dep.name}`);
      }
    }

    await this.storage.saveVersions(newVersions);
    logger.info('Version tracking initialized with:', newVersions);
    this.isInitialized = true;
  }

  /** Check if we can perform an update check (rate limiting) */
  private canCheck(): boolean {
    const now = Date.now();
    return now - this.lastCheckTime >= this.config.minCheckInterval;
  }

  /**
   * Check all remotes for updates
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

    const parsedDeps = parseZephyrDependencies(this.dependencies);
    logger.debug('Parsed dependencies:', parsedDeps);

    const storedVersions = await this.storage.getStoredVersions();
    logger.debug('Stored versions:', storedVersions);

    const remotes: RemoteVersionInfo[] = [];

    // Resolve all remotes using batch resolve
    logger.debug(`Resolving ${parsedDeps.length} remote versions...`);
    const resolvedMap = await this.apiClient.resolveRemotesBatch(parsedDeps);

    for (const dep of parsedDeps) {
      const resolved = resolvedMap.get(dep.name) ?? null;
      logger.debug(`Resolved ${dep.name}:`, resolved);
      if (!resolved) {
        logger.debug(`No resolution for ${dep.name}, skipping`);
        continue;
      }

      const stored = storedVersions[dep.name] ?? null;
      const remoteInfo = createRemoteVersionInfo(dep.name, stored, resolved);

      logger.debug(`Version comparison for ${dep.name}:`, {
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
    const updatesToApply = getRemotesWithUpdates(updates);
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
}
