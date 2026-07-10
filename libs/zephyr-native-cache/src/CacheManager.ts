import NativeMFECache from './NativeMFECache';
import type { BundleMetadata, CachedBundleResult, MFECacheConfig } from './types';
import { getBundleCacheKey, getBundleCacheVariant } from './cache-key';

const LOG_PREFIX = '[MFE-Cache]';

// Default configuration values
const DEFAULT_MAX_CACHE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB
const DEFAULT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const DEFAULT_MIN_CACHE_SIZE_BYTES = 0;

export class CacheManager {
  private bundleDir: string = '';
  private config: MFECacheConfig;

  // In-memory index: bundleUrl → BundleMetadata
  private urlIndex = new Map<string, BundleMetadata>();

  private initialized = false;
  private manifestWrite: Promise<boolean> = Promise.resolve(true);

  constructor(config: MFECacheConfig = {}) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    if (!NativeMFECache) {
      console.warn(`${LOG_PREFIX} NativeMFECache not available, cache disabled`);
      return;
    }

    // Determine bundle storage directory
    const docDir = await NativeMFECache.getDocumentDirectory();
    this.bundleDir = this.config.bundleDir ?? `${docDir}/mfe-bundles`;

    // Recover indexes from disk manifest
    await this.recoverFromDiskManifest();

    // Perform LRU eviction on cold start
    await this.evictLRU();

    this.initialized = true;
    if (this.urlIndex.size > 0) {
      console.info(`${LOG_PREFIX} ready (${this.urlIndex.size} bundles on disk)`);
    } else {
      console.info(`${LOG_PREFIX} ready (empty cache)`);
    }
  }

  async getCachedBundle(bundleUrl: string): Promise<CachedBundleResult | null> {
    const meta = this.urlIndex.get(getBundleCacheKey(bundleUrl));
    if (!meta || meta.status !== 'active') return null;

    // Verify file still exists on disk
    if (NativeMFECache) {
      const exists = await NativeMFECache.fileExists(meta.filePath);
      if (!exists) {
        // File gone, remove from index
        this.removeBundleMetadata(meta);
        await this.saveDiskManifest();
        return null;
      }
    }

    return { source: 'disk', filePath: meta.filePath, metadata: meta };
  }

  async getBundleDestPath(
    remoteName: string,
    bundleUrl: string,
    bundleHash?: string
  ): Promise<string> {
    try {
      const url = new URL(bundleUrl);
      const hostDir = `${url.protocol.replace(':', '')}_${url.host}`.replace(/:/g, '_');
      // Strip trailing slashes — some URL paths end with "/" which creates a directory instead of a file
      let pathname = this.sanitizeRelativePath(url.pathname);
      pathname ||= `${this.sanitizeRelativePath(remoteName) || 'bundle'}.bundle`;
      const variant = getBundleCacheVariant(bundleUrl);
      const contentVariant = bundleHash?.replace(/[^a-z0-9_-]/gi, '').slice(0, 64);
      const suffix = [variant, contentVariant].filter(Boolean).join('.');
      if (suffix) {
        const extensionIndex = pathname.lastIndexOf('.');
        pathname =
          extensionIndex > pathname.lastIndexOf('/')
            ? `${pathname.slice(0, extensionIndex)}.${suffix}${pathname.slice(extensionIndex)}`
            : `${pathname}.${suffix}`;
      }
      return `${this.bundleDir}/${hostDir}/${pathname}`;
    } catch {
      const safeRemoteName = this.sanitizeRelativePath(remoteName) || 'unknown';
      const filename = safeRemoteName.split('/').pop() ?? 'unknown';
      return `${this.bundleDir}/${safeRemoteName}/${filename}.bundle`;
    }
  }

  async saveBundleToCache(
    remoteName: string,
    filePath: string,
    metadata: {
      bundleUrl: string;
      bundleHash?: string;
      buildVersion?: string;
    }
  ): Promise<BundleMetadata> {
    const now = Date.now();
    const meta: BundleMetadata = {
      remoteName,
      bundleHash: metadata.bundleHash ?? '',
      buildVersion: metadata.buildVersion ?? '',
      filePath,
      bundleUrl: getBundleCacheKey(metadata.bundleUrl),
      downloadedAt: now,
      lastUsedAt: now,
      status: 'active',
      retryCount: 0,
      lastRetryAt: null,
    };

    const previous = this.urlIndex.get(meta.bundleUrl);
    this.urlIndex.set(meta.bundleUrl, meta);

    // Persist manifest to disk
    const persisted = await this.saveDiskManifest();
    if (persisted && previous && previous.filePath !== meta.filePath) {
      await this.deleteBundleFiles(previous);
    }

    return meta;
  }

  async updateLastUsedAt(bundleUrl: string): Promise<void> {
    const meta = this.urlIndex.get(getBundleCacheKey(bundleUrl));
    if (!meta) {
      return;
    }
    meta.lastUsedAt = Date.now();
    await this.saveDiskManifest();
  }

  getAllMetadata(): BundleMetadata[] {
    return Array.from(this.urlIndex.values());
  }

  async removeAll(remoteName: string, persist = true): Promise<void> {
    let removed = false;
    for (const meta of this.urlIndex.values()) {
      if (meta.remoteName === remoteName) {
        await this.deleteBundleFiles(meta);
        this.removeBundleMetadata(meta);
        removed = true;
      }
    }
    if (removed && persist) {
      await this.saveDiskManifest();
    }
  }

  /**
   * Pre-download a bundle if its hash has changed. Returns true if a new version was
   * downloaded, false if skipped or failed.
   */
  async preDownloadBundle(bundleUrl: string, newHash: string): Promise<boolean> {
    if (!NativeMFECache) return false;

    const existing = this.urlIndex.get(getBundleCacheKey(bundleUrl));
    const cached = await this.getCachedBundle(bundleUrl);
    // Already cached with the same hash and still present on disk — skip.
    if (cached?.metadata.bundleHash === newHash) return false;

    const remoteName = existing?.remoteName ?? this.inferRemoteName(bundleUrl);
    const destPath = await this.getBundleDestPath(remoteName, bundleUrl, newHash);

    try {
      const { sha256 } = await NativeMFECache.downloadFile(bundleUrl, destPath);

      // Verify downloaded content matches expected hash
      if (sha256 !== newHash) {
        try {
          await NativeMFECache.deleteFile(destPath);
        } catch {
          /* ok */
        }
        return false;
      }

      await this.saveBundleToCache(remoteName, destPath, {
        bundleUrl,
        bundleHash: sha256,
      });

      console.info(`${LOG_PREFIX} pre-downloaded updated bundle: ${bundleUrl}`);
      return true;
    } catch {
      return false;
    }
  }

  async invalidateAllCaches(): Promise<void> {
    const remoteNames = new Set<string>();
    for (const meta of this.urlIndex.values()) {
      remoteNames.add(meta.remoteName);
    }
    for (const name of remoteNames) {
      await this.removeAll(name, false);
    }
    // Remove disk manifest
    if (NativeMFECache) {
      try {
        await this.manifestWrite;
        await NativeMFECache.deleteFile(this.manifestPath);
      } catch {
        /* ok */
      }
    }
    console.info(`${LOG_PREFIX} all caches invalidated`);
  }

  // --- Private helpers ---

  private get manifestPath(): string {
    return `${this.bundleDir}/cache-manifest.json`;
  }

  /** Persist all metadata to a JSON file on disk */
  private saveDiskManifest(): Promise<boolean> {
    const nativeCache = NativeMFECache;
    if (!nativeCache) return Promise.resolve(false);
    const write = async () => {
      try {
        // Build the snapshot inside the serialized writer so concurrent downloads cannot
        // persist an older view after a newer one.
        const bundles = Array.from(this.urlIndex.values()).map((meta) => ({
          ...meta,
          filePath: meta.filePath.startsWith(this.bundleDir)
            ? meta.filePath.slice(this.bundleDir.length + 1)
            : meta.filePath,
        }));
        await nativeCache.writeFile(
          this.manifestPath,
          JSON.stringify({ bundles }),
          'utf8'
        );
        return true;
      } catch {
        // non-critical
        return false;
      }
    };
    this.manifestWrite = this.manifestWrite.then(write, write);
    return this.manifestWrite;
  }

  /** Recover cache index from disk manifest */
  private async recoverFromDiskManifest(): Promise<void> {
    if (!NativeMFECache) return;
    try {
      const exists = await NativeMFECache.fileExists(this.manifestPath);
      if (!exists) return;
      const raw = await NativeMFECache.readFile(this.manifestPath, 'utf8');
      const manifest = JSON.parse(raw);
      if (!Array.isArray(manifest.bundles)) return;

      for (const meta of manifest.bundles as BundleMetadata[]) {
        // Resolve relative filePath back to absolute using current bundleDir
        if (!meta.filePath.startsWith('/')) {
          meta.filePath = `${this.bundleDir}/${meta.filePath}`;
        }
        // Verify the bundle file still exists
        const fileOk = await NativeMFECache.fileExists(meta.filePath);
        if (!fileOk) continue;
        meta.bundleUrl = getBundleCacheKey(meta.bundleUrl);
        this.urlIndex.set(meta.bundleUrl, meta);
      }

      // logged at init summary
    } catch {
      // manifest corrupted or unreadable, start fresh
    }
  }

  private removeBundleMetadata(meta: BundleMetadata): void {
    this.urlIndex.delete(meta.bundleUrl);
  }

  /** Infer a remote name from a bundle URL for storage path generation */
  private inferRemoteName(url: string): string {
    try {
      const parsed = new URL(url);
      const pathParts = parsed.pathname.replace(/^\/+/, '').split('/');
      if (pathParts.length > 0) {
        pathParts[pathParts.length - 1] = pathParts[pathParts.length - 1].split('.')[0];
      }
      return pathParts.join('/') || 'unknown';
    } catch {
      const last = url.split('/').pop() ?? 'unknown';
      return last.split('.')[0];
    }
  }

  private sanitizeRelativePath(value: string): string {
    return value
      .replace(/\\/g, '/')
      .split('/')
      .filter((segment) => segment && segment !== '.' && segment !== '..')
      .map((segment) => segment.replace(/[^a-z0-9._@%+-]/gi, '_'))
      .join('/');
  }

  private async deleteBundleFiles(meta: BundleMetadata): Promise<void> {
    if (!NativeMFECache) return;
    try {
      const exists = await NativeMFECache.fileExists(meta.filePath);
      if (exists) {
        await NativeMFECache.deleteFile(meta.filePath);
      }
    } catch (e) {
      console.warn(`${LOG_PREFIX} failed to delete ${meta.filePath}:`, e);
    }
  }

  /**
   * Evict bundles based on LRU policy. Rules:
   *
   * 1. Only evict bundles older than maxAgeMs (stale)
   * 2. Stop if total size drops below maxCacheSizeBytes
   * 3. Never go below minCacheSizeBytes
   *
   * Fresh bundles (within maxAgeMs) are never evicted, even if over size limit.
   */
  async evictLRU(): Promise<void> {
    if (!NativeMFECache) return;

    const maxSize = this.config.maxCacheSizeBytes ?? DEFAULT_MAX_CACHE_SIZE_BYTES;
    const maxAge = this.config.maxAgeMs ?? DEFAULT_MAX_AGE_MS;
    const minSize = this.config.minCacheSizeBytes ?? DEFAULT_MIN_CACHE_SIZE_BYTES;

    const now = Date.now();

    // Single pass: compute total size and collect stale candidates
    let currentSize = 0;
    const candidates: Array<{ meta: BundleMetadata; size: number }> = [];
    for (const meta of this.urlIndex.values()) {
      let size = 0;
      try {
        size = await NativeMFECache.getFileSize(meta.filePath);
      } catch {
        continue; // Skip files we can't stat
      }
      currentSize += size;
      if (now - meta.lastUsedAt > maxAge) {
        candidates.push({ meta, size });
      }
    }
    // No stale bundles to evict
    if (candidates.length === 0) {
      return;
    }
    candidates.sort((a, b) => a.meta.lastUsedAt - b.meta.lastUsedAt);

    let evictedCount = 0;
    let evictedSize = 0;

    for (const { meta, size } of candidates) {
      // Stop if we're under the max size limit
      if (currentSize <= maxSize) {
        break;
      }
      // Never go below min cache size
      if (currentSize - size < minSize) {
        break;
      }

      // Evict this stale bundle
      await this.deleteBundleFiles(meta);
      this.removeBundleMetadata(meta);
      currentSize -= size;
      evictedCount++;
      evictedSize += size;
    }

    if (evictedCount > 0) {
      await this.saveDiskManifest();
    }
  }
}
