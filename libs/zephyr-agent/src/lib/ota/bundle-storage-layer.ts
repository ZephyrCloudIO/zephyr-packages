import type { BundleMetadata } from 'zephyr-edge-contract';
import { ZephyrError, ZeErrors } from '../errors';

/** Calculate byte size of a string (handles UTF-8 multi-byte characters) */
function getByteSize(str: string): number {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(str).length;
  }
  // Fallback for environments without TextEncoder (Node.js < 11)
  return Buffer.byteLength(str, 'utf8');
}

/** Storage configuration for bundle caching */
export interface BundleStorageConfig {
  /** Root directory for bundle cache (e.g., DocumentDirectoryPath + '/zephyr-bundles') */
  cacheDir: string;
  /** Maximum cache size in bytes (default: 100MB) */
  maxCacheSize?: number;
  /** Enable debug logging */
  debug?: boolean;
}

/** Cache index entry for fast lookup */
export interface CacheIndexEntry {
  /** Bundle metadata */
  metadata: BundleMetadata;
  /** Full file path on disk */
  filePath: string;
  /** Size in bytes */
  size: number;
  /** Timestamp when cached */
  cachedAt: number;
  /** Last access timestamp (for LRU) */
  lastAccessed: number;
  /** Application UID this bundle belongs to */
  applicationUid: string;
  /** Version this bundle belongs to */
  version: string;
}

/** Cache index for fast bundle lookups */
export interface CacheIndex {
  /** Map of checksum -> cache entry */
  entries: Record<string, CacheIndexEntry>;
  /** Total cache size in bytes */
  totalSize: number;
  /** Last updated timestamp */
  lastUpdated: number;
}

/**
 * BundleStorageLayer manages persistent storage of JavaScript bundles for OTA updates
 *
 * Features:
 *
 * - Atomic writes (temp → verify → move)
 * - Cache directory management
 * - Cache index for O(1) lookups
 * - LRU eviction support
 * - React Native file system integration
 *
 * Platform Support:
 *
 * - React Native: Uses react-native-fs
 * - Web: Not supported (uses in-memory loading)
 */
export class BundleStorageLayer {
  private config: Required<BundleStorageConfig>;
  private fs: any; // RNFS instance
  private cacheIndex: CacheIndex | null = null;
  private indexFilePath: string;
  private isReactNative: boolean;

  constructor(config: BundleStorageConfig) {
    this.config = {
      maxCacheSize: 100 * 1024 * 1024, // 100MB default
      debug: false,
      ...config,
    };

    this.indexFilePath = `${this.config.cacheDir}/.cache-index.json`;
    this.isReactNative = this.detectReactNative();

    if (this.isReactNative) {
      try {
        // Dynamic require for React Native only
        this.fs = require('react-native-fs');
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (error) {
        this.log('react-native-fs not available, storage layer disabled');
        this.fs = null;
      }
    } else {
      this.log('Not running in React Native, storage layer disabled');
      this.fs = null;
    }
  }

  /** Initialize storage layer - creates cache directory and loads index */
  async initialize(): Promise<void> {
    if (!this.fs) {
      this.log(
        'Storage layer not available (missing react-native-fs or not React Native)'
      );
      return;
    }

    try {
      // Create cache directory if it doesn't exist
      const exists = await this.fs.exists(this.config.cacheDir);
      if (!exists) {
        await this.fs.mkdir(this.config.cacheDir);
        this.log(`Created cache directory: ${this.config.cacheDir}`);
      }

      // Load or create cache index
      await this.loadCacheIndex();

      this.log('Storage layer initialized', {
        cacheDir: this.config.cacheDir,
        maxCacheSize: this.config.maxCacheSize,
        currentSize: this.cacheIndex?.totalSize || 0,
        entryCount: Object.keys(this.cacheIndex?.entries || {}).length,
      });
    } catch (error) {
      this.log('Failed to initialize storage layer:', error);
      throw error;
    }
  }

  /**
   * Store a bundle to disk using atomic write pattern
   *
   * @param bundle Bundle metadata
   * @param data Bundle contents (as string)
   * @param applicationUid Application this bundle belongs to
   * @param version Version this bundle belongs to
   * @returns Full file path where bundle was stored
   */
  async storeBundle(
    bundle: BundleMetadata,
    data: string,
    applicationUid: string,
    version: string
  ): Promise<string> {
    if (!this.fs) {
      throw new ZephyrError(ZeErrors.ERR_OTA_STORAGE_UNAVAILABLE, {});
    }

    const finalPath = `${this.config.cacheDir}/${bundle.checksum}`;
    const tempPath = `${finalPath}.tmp`;

    try {
      // Step 1: Calculate actual byte size before writing
      // This handles UTF-8 multi-byte characters correctly
      const actualByteSize = getByteSize(data);

      // Step 2: Write to temp file
      await this.fs.writeFile(tempPath, data, 'utf8');
      this.log(`Wrote bundle to temp file: ${tempPath}`);

      // Step 3: Verify file was written correctly using calculated byte size
      const stats = await this.fs.stat(tempPath);
      if (stats.size !== actualByteSize) {
        throw new ZephyrError(ZeErrors.ERR_OTA_SIZE_MISMATCH, {
          expected: actualByteSize,
          actual: stats.size,
        });
      }

      // Step 4: Optional - verify against bundle.size if it represents byte size
      // Note: bundle.size from metadata may be string length or byte size depending on source
      // We log a warning if there's a mismatch but don't fail
      if (bundle.size && stats.size !== bundle.size) {
        this.log(
          `Warning: Bundle metadata size (${bundle.size}) differs from actual file size (${stats.size}). ` +
            `This may indicate metadata uses string length instead of byte size.`
        );
      }

      // Step 5: Atomic move to final location
      await this.fs.moveFile(tempPath, finalPath);
      this.log(`Moved bundle to final location: ${finalPath}`);

      // Step 6: Update cache index
      const now = Date.now();
      const entry: CacheIndexEntry = {
        metadata: bundle,
        filePath: finalPath,
        size: stats.size,
        cachedAt: now,
        lastAccessed: now,
        applicationUid,
        version,
      };

      if (!this.cacheIndex) {
        await this.loadCacheIndex();
      }

      this.cacheIndex!.entries[bundle.checksum] = entry;
      this.cacheIndex!.totalSize += stats.size;
      this.cacheIndex!.lastUpdated = now;

      await this.saveCacheIndex();

      return finalPath;
    } catch (error) {
      // Cleanup temp file on error
      try {
        const tempExists = await this.fs.exists(tempPath);
        if (tempExists) {
          await this.fs.unlink(tempPath);
        }
      } catch {
        // Ignore cleanup errors
      }

      this.log('Failed to store bundle:', error);
      throw error;
    }
  }

  /**
   * Check if a bundle exists in cache
   *
   * @param checksum SHA-256 checksum
   * @returns True if bundle exists and is valid
   */
  async hasBundle(checksum: string): Promise<boolean> {
    if (!this.fs || !this.cacheIndex) {
      return false;
    }

    const entry = this.cacheIndex.entries[checksum];
    if (!entry) {
      return false;
    }

    // Verify file still exists on disk
    try {
      const exists = await this.fs.exists(entry.filePath);
      if (!exists) {
        // Remove stale entry from index
        delete this.cacheIndex.entries[checksum];
        this.cacheIndex.totalSize -= entry.size;
        await this.saveCacheIndex();
        return false;
      }

      // Update last accessed time
      entry.lastAccessed = Date.now();
      await this.saveCacheIndex();

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get bundle file path from cache
   *
   * @param checksum SHA-256 checksum
   * @returns File path or null if not found
   */
  async getBundlePath(checksum: string): Promise<string | null> {
    if (!this.fs || !this.cacheIndex) {
      return null;
    }

    const entry = this.cacheIndex.entries[checksum];
    if (!entry) {
      return null;
    }

    // Verify file exists
    const exists = await this.fs.exists(entry.filePath);
    if (!exists) {
      // Remove stale entry
      delete this.cacheIndex.entries[checksum];
      this.cacheIndex.totalSize -= entry.size;
      await this.saveCacheIndex();
      return null;
    }

    // Update last accessed time
    entry.lastAccessed = Date.now();
    await this.saveCacheIndex();

    return `file://${entry.filePath}`;
  }

  /**
   * Get all cached bundles for a specific version
   *
   * @param applicationUid Application UID
   * @param version Version string
   * @returns Array of cache entries
   */
  async getBundlesForVersion(
    applicationUid: string,
    version: string
  ): Promise<CacheIndexEntry[]> {
    if (!this.cacheIndex) {
      return [];
    }

    return Object.values(this.cacheIndex.entries).filter(
      (entry) => entry.applicationUid === applicationUid && entry.version === version
    );
  }

  /**
   * Delete bundles for a specific version
   *
   * @param applicationUid Application UID
   * @param version Version string
   * @returns Number of bundles deleted
   */
  async deleteVersion(applicationUid: string, version: string): Promise<number> {
    if (!this.fs || !this.cacheIndex) {
      return 0;
    }

    const bundles = await this.getBundlesForVersion(applicationUid, version);
    let deletedCount = 0;

    for (const entry of bundles) {
      try {
        const exists = await this.fs.exists(entry.filePath);
        if (exists) {
          await this.fs.unlink(entry.filePath);
        }

        delete this.cacheIndex.entries[entry.metadata.checksum];
        this.cacheIndex.totalSize -= entry.size;
        deletedCount++;
      } catch (error) {
        this.log(`Failed to delete bundle ${entry.metadata.checksum}:`, error);
      }
    }

    if (deletedCount > 0) {
      this.cacheIndex.lastUpdated = Date.now();
      await this.saveCacheIndex();
    }

    this.log(`Deleted ${deletedCount} bundles for version ${version}`);
    return deletedCount;
  }

  /** Get cache statistics */
  getCacheStats(): {
    totalSize: number;
    entryCount: number;
    maxSize: number;
    utilization: number;
  } {
    const totalSize = this.cacheIndex?.totalSize || 0;
    const entryCount = Object.keys(this.cacheIndex?.entries || {}).length;
    const maxSize = this.config.maxCacheSize;
    const utilization = maxSize > 0 ? totalSize / maxSize : 0;

    return {
      totalSize,
      entryCount,
      maxSize,
      utilization,
    };
  }

  /** Get LRU sorted entries (least recently used first) Used by cache manager for eviction */
  getLRUSortedEntries(): CacheIndexEntry[] {
    if (!this.cacheIndex) {
      return [];
    }

    return Object.values(this.cacheIndex.entries).sort(
      (a, b) => a.lastAccessed - b.lastAccessed
    );
  }

  /** Load cache index from disk */
  private async loadCacheIndex(): Promise<void> {
    if (!this.fs) {
      return;
    }

    try {
      const exists = await this.fs.exists(this.indexFilePath);
      if (!exists) {
        this.cacheIndex = {
          entries: {},
          totalSize: 0,
          lastUpdated: Date.now(),
        };
        await this.saveCacheIndex();
        return;
      }

      const content = await this.fs.readFile(this.indexFilePath, 'utf8');
      this.cacheIndex = JSON.parse(content);
      this.log('Loaded cache index', {
        entries: Object.keys(this.cacheIndex!.entries).length,
        totalSize: this.cacheIndex!.totalSize,
      });
    } catch (error) {
      this.log('Failed to load cache index, creating new one:', error);
      this.cacheIndex = {
        entries: {},
        totalSize: 0,
        lastUpdated: Date.now(),
      };
      await this.saveCacheIndex();
    }
  }

  /** Save cache index to disk */
  private async saveCacheIndex(): Promise<void> {
    if (!this.fs || !this.cacheIndex) {
      return;
    }

    try {
      const content = JSON.stringify(this.cacheIndex, null, 2);
      await this.fs.writeFile(this.indexFilePath, content, 'utf8');
    } catch (error) {
      this.log('Failed to save cache index:', error);
    }
  }

  /** Detect if running in React Native environment */
  private detectReactNative(): boolean {
    try {
      return typeof navigator !== 'undefined' && navigator.product === 'ReactNative';
    } catch {
      return false;
    }
  }

  /** Debug logging */
  private log(message: string, data?: any): void {
    if (this.config.debug) {
      console.log(`[BundleStorage] ${message}`, data || '');
    }
  }
}
