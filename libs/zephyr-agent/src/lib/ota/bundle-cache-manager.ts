import type { BundleStorageLayer, CacheIndexEntry } from './bundle-storage-layer';

/** Cache eviction strategy */
export enum EvictionStrategy {
  /** Least Recently Used - evict oldest accessed bundles first */
  LRU = 'lru',
  /** First In First Out - evict oldest cached bundles first */
  FIFO = 'fifo',
  /** Largest First - evict largest bundles first */
  LARGEST_FIRST = 'largest_first',
}

/** Cache policy configuration */
export interface CachePolicy {
  /** Maximum cache size in bytes */
  maxCacheSize?: number;
  /** Maximum number of versions to keep per application */
  maxVersionsPerApp?: number;
  /** Eviction strategy */
  evictionStrategy?: EvictionStrategy;
  /** Minimum free space to maintain (in bytes) */
  minFreeSpace?: number;
  /** Auto-cleanup on startup */
  autoCleanup?: boolean;
  /** Enable debug logging */
  debug?: boolean;
}

/** Cache metrics for monitoring */
export interface CacheMetrics {
  /** Total cache size in bytes */
  totalSize: number;
  /** Number of cached bundles */
  bundleCount: number;
  /** Number of cache hits */
  hits: number;
  /** Number of cache misses */
  misses: number;
  /** Number of evictions performed */
  evictions: number;
  /** Number of versions cleaned up */
  versionsCleanedUp: number;
  /** Cache hit rate (0-1) */
  hitRate: number;
  /** Cache utilization (0-1) */
  utilization: number;
  /** Last eviction timestamp */
  lastEviction?: number;
  /** Last cleanup timestamp */
  lastCleanup?: number;
}

/** Version info for cleanup */
export interface VersionInfo {
  applicationUid: string;
  version: string;
  bundleCount: number;
  totalSize: number;
  oldestAccess: number;
  newestAccess: number;
}

/** Eviction result */
export interface EvictionResult {
  /** Number of bundles evicted */
  bundlesEvicted: number;
  /** Total bytes freed */
  bytesFreed: number;
  /** Eviction took this many milliseconds */
  durationMs: number;
}

/**
 * BundleCacheManager handles cache eviction, version cleanup, and metrics
 *
 * Features:
 *
 * - LRU eviction when cache exceeds size limit
 * - Version-based cleanup (remove old versions)
 * - Cache metrics (hits, misses, evictions)
 * - Configurable eviction strategies
 * - Automatic cleanup on startup
 *
 * Usage:
 *
 * ```ts
 * const cacheManager = new BundleCacheManager(storageLayer, {
 *   maxCacheSize: 100 * 1024 * 1024, // 100MB
 *   maxVersionsPerApp: 3,
 *   evictionStrategy: EvictionStrategy.LRU,
 *   autoCleanup: true,
 *   debug: true,
 * });
 *
 * await cacheManager.initialize();
 *
 * // Check cache before download
 * const isCached = await cacheManager.isCached(bundle.checksum);
 *
 * // Enforce cache limits
 * await cacheManager.enforceLimit();
 *
 * // Cleanup old versions
 * await cacheManager.cleanupOldVersions('app-123');
 *
 * // Get metrics
 * const metrics = cacheManager.getMetrics();
 * ```
 */
export class BundleCacheManager {
  private storageLayer: BundleStorageLayer;
  private policy: Required<CachePolicy>;
  private metrics: CacheMetrics;

  constructor(storageLayer: BundleStorageLayer, policy: CachePolicy = {}) {
    this.storageLayer = storageLayer;

    this.policy = {
      maxCacheSize: 100 * 1024 * 1024, // 100MB default
      maxVersionsPerApp: 3,
      evictionStrategy: EvictionStrategy.LRU,
      minFreeSpace: 10 * 1024 * 1024, // 10MB default
      autoCleanup: true,
      debug: false,
      ...policy,
    };

    this.metrics = {
      totalSize: 0,
      bundleCount: 0,
      hits: 0,
      misses: 0,
      evictions: 0,
      versionsCleanedUp: 0,
      hitRate: 0,
      utilization: 0,
    };
  }

  /** Initialize cache manager */
  async initialize(): Promise<void> {
    this.log('Initializing cache manager');

    // Update metrics from storage
    await this.updateMetrics();

    // Auto-cleanup if enabled
    if (this.policy.autoCleanup) {
      await this.performCleanup();
    }

    this.log('Cache manager initialized', this.metrics);
  }

  /**
   * Check if bundle is cached (updates hit/miss metrics)
   *
   * @param checksum Bundle checksum
   * @returns True if cached
   */
  async isCached(checksum: string): Promise<boolean> {
    const cached = await this.storageLayer.hasBundle(checksum);

    if (cached) {
      this.metrics.hits++;
    } else {
      this.metrics.misses++;
    }

    this.updateHitRate();

    return cached;
  }

  /**
   * Enforce cache size limit by evicting bundles
   *
   * @returns Eviction result
   */
  async enforceLimit(): Promise<EvictionResult> {
    const startTime = Date.now();

    await this.updateMetrics();

    const stats = this.storageLayer.getCacheStats();
    const currentSize = stats.totalSize;
    const targetSize = this.policy.maxCacheSize - this.policy.minFreeSpace;

    if (currentSize <= targetSize) {
      this.log('Cache within limits', { currentSize, targetSize });
      return {
        bundlesEvicted: 0,
        bytesFreed: 0,
        durationMs: Date.now() - startTime,
      };
    }

    const bytesToFree = currentSize - targetSize;
    this.log('Cache over limit, need to free bytes', {
      currentSize,
      targetSize,
      bytesToFree,
    });

    let bundlesEvicted = 0;
    let bytesFreed = 0;

    // Get candidates for eviction based on strategy
    const candidates = this.getEvictionCandidates();

    // Evict bundles until we free enough space
    for (const entry of candidates) {
      if (bytesFreed >= bytesToFree) {
        break;
      }

      try {
        // Delete bundle from storage
        await this.storageLayer.deleteVersion(entry.applicationUid, entry.version);

        bundlesEvicted++;
        bytesFreed += entry.size;
        this.metrics.evictions++;

        this.log('Evicted bundle', {
          checksum: entry.metadata.checksum,
          size: entry.size,
          applicationUid: entry.applicationUid,
          version: entry.version,
        });
      } catch (error) {
        this.log('Failed to evict bundle:', error);
      }
    }

    this.metrics.lastEviction = Date.now();
    await this.updateMetrics();

    const result = {
      bundlesEvicted,
      bytesFreed,
      durationMs: Date.now() - startTime,
    };

    this.log('Eviction complete', result);
    return result;
  }

  /**
   * Cleanup old versions for a specific application
   *
   * @param applicationUid Application UID
   * @param keepVersions Number of versions to keep (defaults to maxVersionsPerApp)
   * @returns Number of versions cleaned up
   */
  async cleanupOldVersions(
    applicationUid: string,
    keepVersions?: number
  ): Promise<number> {
    const versionsToKeep = keepVersions ?? this.policy.maxVersionsPerApp;

    // Get all versions for this app
    const versions = await this.getVersions(applicationUid);

    if (versions.length <= versionsToKeep) {
      this.log('No cleanup needed', {
        applicationUid,
        versions: versions.length,
        keepVersions: versionsToKeep,
      });
      return 0;
    }

    // Sort by newest access (keep most recently accessed)
    versions.sort((a, b) => b.newestAccess - a.newestAccess);

    // Delete old versions
    const versionsToDelete = versions.slice(versionsToKeep);
    let cleanedUp = 0;

    for (const versionInfo of versionsToDelete) {
      try {
        await this.storageLayer.deleteVersion(
          versionInfo.applicationUid,
          versionInfo.version
        );
        cleanedUp++;
        this.metrics.versionsCleanedUp++;

        this.log('Cleaned up version', {
          applicationUid: versionInfo.applicationUid,
          version: versionInfo.version,
          bundleCount: versionInfo.bundleCount,
          size: versionInfo.totalSize,
        });
      } catch (error) {
        this.log('Failed to cleanup version:', error);
      }
    }

    this.metrics.lastCleanup = Date.now();
    await this.updateMetrics();

    return cleanedUp;
  }

  /**
   * Cleanup all old versions across all applications
   *
   * @returns Total number of versions cleaned up
   */
  async cleanupAllOldVersions(): Promise<number> {
    const applications = await this.getAllApplications();
    let totalCleanedUp = 0;

    for (const applicationUid of applications) {
      const cleaned = await this.cleanupOldVersions(applicationUid);
      totalCleanedUp += cleaned;
    }

    return totalCleanedUp;
  }

  /**
   * Clear entire cache
   *
   * @returns Number of bundles deleted
   */
  async clearCache(): Promise<number> {
    this.log('Clearing entire cache');

    const entries = this.storageLayer.getLRUSortedEntries();
    let deleted = 0;

    // Group by version to use deleteVersion (more efficient)
    const versionMap = new Map<string, Set<string>>();

    for (const entry of entries) {
      const key = `${entry.applicationUid}:${entry.version}`;
      if (!versionMap.has(key)) {
        versionMap.set(key, new Set());
      }
      versionMap.get(key)!.add(entry.metadata.checksum);
    }

    // Delete all versions
    for (const [key] of versionMap) {
      const [applicationUid, version] = key.split(':');
      try {
        const count = await this.storageLayer.deleteVersion(applicationUid, version);
        deleted += count;
      } catch (error) {
        this.log(`Failed to delete version ${key}:`, error);
      }
    }

    // Reset metrics
    this.metrics = {
      totalSize: 0,
      bundleCount: 0,
      hits: this.metrics.hits,
      misses: this.metrics.misses,
      evictions: this.metrics.evictions,
      versionsCleanedUp: this.metrics.versionsCleanedUp,
      hitRate: this.metrics.hitRate,
      utilization: 0,
      lastEviction: this.metrics.lastEviction,
      lastCleanup: Date.now(),
    };

    this.log('Cache cleared', { bundlesDeleted: deleted });
    return deleted;
  }

  /** Get cache metrics */
  getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }

  /** Reset metrics (keeps cache intact) */
  resetMetrics(): void {
    this.metrics.hits = 0;
    this.metrics.misses = 0;
    this.metrics.evictions = 0;
    this.metrics.versionsCleanedUp = 0;
    this.metrics.hitRate = 0;
    this.updateHitRate();
  }

  /** Get eviction candidates based on strategy */
  private getEvictionCandidates(): CacheIndexEntry[] {
    const entries = this.storageLayer.getLRUSortedEntries();

    switch (this.policy.evictionStrategy) {
      case EvictionStrategy.LRU:
        // Already sorted by LRU (oldest accessed first)
        return entries;

      case EvictionStrategy.FIFO:
        // Sort by cached time (oldest first)
        return entries.sort((a, b) => a.cachedAt - b.cachedAt);

      case EvictionStrategy.LARGEST_FIRST:
        // Sort by size (largest first)
        return entries.sort((a, b) => b.size - a.size);

      default:
        return entries;
    }
  }

  /** Get all versions for an application */
  private async getVersions(applicationUid: string): Promise<VersionInfo[]> {
    const entries = this.storageLayer.getLRUSortedEntries();

    // Group by version
    const versionMap = new Map<string, CacheIndexEntry[]>();

    for (const entry of entries) {
      if (entry.applicationUid === applicationUid) {
        if (!versionMap.has(entry.version)) {
          versionMap.set(entry.version, []);
        }
        versionMap.get(entry.version)!.push(entry);
      }
    }

    // Create version info
    const versions: VersionInfo[] = [];

    for (const [version, versionEntries] of versionMap) {
      const totalSize = versionEntries.reduce((sum, e) => sum + e.size, 0);
      const accessTimes = versionEntries.map((e) => e.lastAccessed);
      const oldestAccess = Math.min(...accessTimes);
      const newestAccess = Math.max(...accessTimes);

      versions.push({
        applicationUid,
        version,
        bundleCount: versionEntries.length,
        totalSize,
        oldestAccess,
        newestAccess,
      });
    }

    return versions;
  }

  /** Get all unique application UIDs */
  private async getAllApplications(): Promise<string[]> {
    const entries = this.storageLayer.getLRUSortedEntries();
    const apps = new Set<string>();

    for (const entry of entries) {
      apps.add(entry.applicationUid);
    }

    return Array.from(apps);
  }

  /** Perform automatic cleanup */
  private async performCleanup(): Promise<void> {
    this.log('Performing automatic cleanup');

    // 1. Enforce cache limits
    await this.enforceLimit();

    // 2. Cleanup old versions across all apps
    const cleaned = await this.cleanupAllOldVersions();

    this.log('Automatic cleanup complete', { versionsCleanedUp: cleaned });
  }

  /** Update metrics from storage */
  private async updateMetrics(): Promise<void> {
    const stats = this.storageLayer.getCacheStats();

    this.metrics.totalSize = stats.totalSize;
    this.metrics.bundleCount = stats.entryCount;
    this.metrics.utilization = stats.utilization;

    this.updateHitRate();
  }

  /** Update hit rate calculation */
  private updateHitRate(): void {
    const total = this.metrics.hits + this.metrics.misses;
    this.metrics.hitRate = total > 0 ? this.metrics.hits / total : 0;
  }

  /** Debug logging */
  private log(message: string, data?: any): void {
    if (this.policy.debug) {
      console.log(`[BundleCache] ${message}`, data || '');
    }
  }
}
