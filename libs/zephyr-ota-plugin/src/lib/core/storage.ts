import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  StoredVersions,
  StoredVersionInfo,
  ZephyrOTAConfig,
  StorageOperation,
  StorageErrorHandler,
} from '../types';
import { DEFAULT_OTA_CONFIG } from '../types';
import { createScopedLogger } from '../utils/logger';

const logger = createScopedLogger('Storage');

/** Storage keys used by the OTA plugin */
const STORAGE_KEYS = {
  VERSIONS: '@zephyr_ota/versions',
  LAST_CHECK: '@zephyr_ota/last_check',
  DISMISS_UNTIL: '@zephyr_ota/dismiss_until',
} as const;

/** Storage layer for OTA plugin data persistence */
export class OTAStorage {
  private readonly dismissDuration: number;
  private readonly onError?: StorageErrorHandler;

  constructor(config: ZephyrOTAConfig) {
    this.dismissDuration = config.dismissDuration ?? DEFAULT_OTA_CONFIG.dismissDuration;
    this.onError = config.onStorageError;
  }

  /** Report a storage error to the configured handler */
  private reportError(operation: StorageOperation, error: unknown): void {
    const storageError = {
      operation,
      error: error instanceof Error ? error : new Error(String(error)),
      timestamp: Date.now(),
    };

    logger.warn(`Storage operation '${operation}' failed:`, storageError.error);

    if (this.onError) {
      try {
        this.onError(storageError);
      } catch (callbackError) {
        logger.error('Error in onStorageError callback:', callbackError);
      }
    }
  }

  /** Get stored versions for all remotes */
  async getStoredVersions(): Promise<StoredVersions> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.VERSIONS);
      if (stored) {
        return JSON.parse(stored) as StoredVersions;
      }
    } catch (error) {
      this.reportError('getVersions', error);
    }
    return {};
  }

  /** Save versions for all remotes */
  async saveVersions(versions: StoredVersions): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.VERSIONS, JSON.stringify(versions));
      logger.debug('Saved versions:', versions);
    } catch (error) {
      this.reportError('saveVersions', error);
    }
  }

  /** Get stored version for a specific remote */
  async getRemoteVersion(remoteName: string): Promise<StoredVersionInfo | null> {
    const versions = await this.getStoredVersions();
    return versions[remoteName] ?? null;
  }

  /** Save version for a specific remote */
  async saveRemoteVersion(
    remoteName: string,
    versionInfo: StoredVersionInfo
  ): Promise<void> {
    const versions = await this.getStoredVersions();
    versions[remoteName] = versionInfo;
    await this.saveVersions(versions);
  }

  /** Get the timestamp of the last update check */
  async getLastCheckTime(): Promise<number | null> {
    try {
      const lastCheck = await AsyncStorage.getItem(STORAGE_KEYS.LAST_CHECK);
      if (lastCheck) {
        return parseInt(lastCheck, 10);
      }
    } catch (error) {
      this.reportError('getLastCheck', error);
    }
    return null;
  }

  /** Save the timestamp of the last update check */
  async setLastCheckTime(timestamp: number): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_CHECK, timestamp.toString());
    } catch (error) {
      this.reportError('setLastCheck', error);
    }
  }

  /** Check if updates are dismissed (user clicked "Later") */
  async isDismissed(): Promise<boolean> {
    try {
      const dismissUntil = await AsyncStorage.getItem(STORAGE_KEYS.DISMISS_UNTIL);
      if (dismissUntil) {
        return Date.now() < parseInt(dismissUntil, 10);
      }
    } catch (error) {
      this.reportError('isDismissed', error);
    }
    return false;
  }

  /** Dismiss update prompts for the configured duration */
  async dismiss(): Promise<void> {
    try {
      const dismissUntil = Date.now() + this.dismissDuration;
      await AsyncStorage.setItem(STORAGE_KEYS.DISMISS_UNTIL, dismissUntil.toString());
      logger.debug(`Dismissed until ${new Date(dismissUntil).toISOString()}`);
    } catch (error) {
      this.reportError('dismiss', error);
    }
  }

  /** Clear dismiss state (after applying updates) */
  async clearDismiss(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.DISMISS_UNTIL);
      logger.debug('Cleared dismiss state');
    } catch (error) {
      this.reportError('clearDismiss', error);
    }
  }

  /** Clear all OTA storage data */
  async clearAll(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.VERSIONS,
        STORAGE_KEYS.LAST_CHECK,
        STORAGE_KEYS.DISMISS_UNTIL,
      ]);
      logger.info('Cleared all OTA storage');
    } catch (error) {
      this.reportError('clearAll', error);
    }
  }
}
