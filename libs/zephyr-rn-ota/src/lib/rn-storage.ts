/**
 * React Native Storage Abstraction with graceful AsyncStorage handling
 *
 * CRITICAL: AsyncStorage is a peer dependency that might not be available We need
 * graceful fallbacks for different RN versions and configurations
 */

interface StorageInterface {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  clear?(): Promise<void>;
}

class MemoryStorage implements StorageInterface {
  private storage = new Map<string, string>();

  async getItem(key: string): Promise<string | null> {
    return this.storage.get(key) || null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.storage.set(key, value);
  }

  async removeItem(key: string): Promise<void> {
    this.storage.delete(key);
  }

  async clear(): Promise<void> {
    this.storage.clear();
  }
}

class ZephyrRNStorage {
  private storage: StorageInterface;
  private isAsyncStorageAvailable = false;

  constructor() {
    this.storage = this.initializeStorage();
  }

  private initializeStorage(): StorageInterface {
    // Try to import AsyncStorage with multiple fallback attempts
    try {
      // Method 1: Try @react-native-async-storage/async-storage (RN 0.60+)
      const AsyncStorage = this.tryImportAsyncStorage();
      if (AsyncStorage) {
        this.isAsyncStorageAvailable = true;
        console.log('[Zephyr Storage] Using @react-native-async-storage/async-storage');
        return AsyncStorage;
      }
    } catch (error) {
      console.warn('[Zephyr Storage] Failed to import AsyncStorage:', error);
    }

    // Fallback to memory storage
    console.warn(
      '[Zephyr Storage] AsyncStorage not available, using memory storage (data will not persist)'
    );
    return new MemoryStorage();
  }

  private tryImportAsyncStorage(): StorageInterface | null {
    try {
      // Check if AsyncStorage is available in global scope first
      const global = this.getGlobalObject();
      if (global.__ZEPHYR_ASYNC_STORAGE__) {
        return global.__ZEPHYR_ASYNC_STORAGE__;
      }

      // Try dynamic require (this might not work in all bundler configurations)
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;

      // Validate it has the methods we need
      if (AsyncStorage && typeof AsyncStorage.getItem === 'function') {
        return AsyncStorage;
      }

      return null;
    } catch (error) {
      // Try legacy AsyncStorage location (RN < 0.60)
      try {
        const { AsyncStorage } = require('react-native');
        if (AsyncStorage && typeof AsyncStorage.getItem === 'function') {
          console.warn('[Zephyr Storage] Using legacy AsyncStorage from react-native');
          return AsyncStorage;
        }
      } catch (legacyError) {
        // Both failed
      }
      return null;
    }
  }

  private getGlobalObject(): any {
    if (typeof globalThis !== 'undefined') return globalThis;
    if (typeof global !== 'undefined') return global;
    if (typeof window !== 'undefined') return window;
    return {};
  }

  async getItem(key: string): Promise<string | null> {
    try {
      return await this.storage.getItem(key);
    } catch (error) {
      console.warn(`[Zephyr Storage] Failed to get item "${key}":`, error);
      return null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      await this.storage.setItem(key, value);
    } catch (error) {
      console.warn(`[Zephyr Storage] Failed to set item "${key}":`, error);
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      await this.storage.removeItem(key);
    } catch (error) {
      console.warn(`[Zephyr Storage] Failed to remove item "${key}":`, error);
    }
  }

  async clear(): Promise<void> {
    try {
      if (this.storage.clear) {
        await this.storage.clear();
      }
    } catch (error) {
      console.warn('[Zephyr Storage] Failed to clear storage:', error);
    }
  }

  getStorageInfo() {
    return {
      type: this.isAsyncStorageAvailable ? 'AsyncStorage' : 'Memory',
      persistent: this.isAsyncStorageAvailable,
      available: true,
    };
  }

  /** Helper method to set up AsyncStorage manually if needed */
  static setupAsyncStorage(AsyncStorageImplementation: StorageInterface): void {
    const global = (function () {
      if (typeof globalThis !== 'undefined') return globalThis;
      if (typeof global !== 'undefined') return global;
      if (typeof window !== 'undefined') return window;
      return {};
    })();

    (global as any).__ZEPHYR_ASYNC_STORAGE__ = AsyncStorageImplementation;
    console.log('[Zephyr Storage] AsyncStorage implementation set up manually');
  }
}

// Export singleton instance
export const rnStorage = new ZephyrRNStorage();

// Export class for manual setup
export { ZephyrRNStorage };

// Export type for custom implementations
export type { StorageInterface };
