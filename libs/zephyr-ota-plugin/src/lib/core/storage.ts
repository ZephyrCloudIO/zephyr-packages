import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StoredVersions, StoredVersionInfo, ZephyrOTAConfig } from '../types';
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

  constructor(config: ZephyrOTAConfig) {
    this.dismissDuration = config.dismissDuration ?? DEFAULT_OTA_CONFIG.dismissDuration;
  }

  /** Get stored versions for all remotes */
  async getStoredVersions(): Promise<StoredVersions> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.VERSIONS);
      if (stored) {
        return JSON.parse(stored) as StoredVersions;
      }
    } catch (error) {
      logger.warn('Failed to get stored versions:', error);
    }
    return {};
  }

  /** Save versions for all remotes */
  async saveVersions(versions: StoredVersions): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.VERSIONS, JSON.stringify(versions));
      logger.debug('Saved versions:', versions);
    } catch (error) {
      logger.warn('Failed to save versions:', error);
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
      logger.warn('Failed to get last check time:', error);
    }
    return null;
  }

  /** Save the timestamp of the last update check */
  async setLastCheckTime(timestamp: number): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_CHECK, timestamp.toString());
    } catch (error) {
      logger.warn('Failed to save last check time:', error);
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
      logger.warn('Failed to check dismiss state:', error);
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
      logger.warn('Failed to save dismiss state:', error);
    }
  }

  /** Clear dismiss state (after applying updates) */
  async clearDismiss(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.DISMISS_UNTIL);
      logger.debug('Cleared dismiss state');
    } catch (error) {
      logger.warn('Failed to clear dismiss state:', error);
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
      logger.warn('Failed to clear storage:', error);
    }
  }
}
