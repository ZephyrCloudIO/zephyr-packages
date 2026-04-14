import { CacheManager } from './CacheManager';
import NativeMFECache from './NativeMFECache';
import mitt from 'mitt';
import type { BundleMetadata, CacheEventMap, MFECacheConfig } from './types';

const LOG_PREFIX = '[MFE-Cache]';

interface ManifestSource {
  extractHashes: (manifest: any, manifestUrl: string) => Map<string, string>;
}

export class BundleCacheLayer {
  private cacheManager: CacheManager | null = null;
  private initPromise: Promise<void> | null = null;
  private config: MFECacheConfig;

  // Bundle hash map: bundleUrl (without query params) → expected hash
  // Shared via globalThis.__MFE_BUNDLE_HASHES__ for cross-instance access
  private bundleHashMap: Record<string, string>;

  // Manifest sources for polling: manifestUrl → ManifestSource
  private manifestSources = new Map<string, ManifestSource>();

  // Polling state
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private isCheckingUpdates = false;
  private static DEFAULT_POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

  // Event emitter for cache lifecycle events
  readonly events = mitt<CacheEventMap>();

  constructor(config: MFECacheConfig = {}) {
    this.config = config;

    // Share bundleHashMap via globalThis for cross-instance access
    this.bundleHashMap =
      (globalThis as any).__MFE_BUNDLE_HASHES__ ??
      ((globalThis as any).__MFE_BUNDLE_HASHES__ = {});

    // Install JSI bindings if available (provides __MFE_readFileSync)
    if (NativeMFECache && typeof (NativeMFECache as any).installJSI === 'function') {
      (NativeMFECache as any).installJSI();
    }
  }

  // --- Registration (called by bundler integration layer) ---

  registerBundleHash(bundleUrl: string, hash: string): void {
    this.bundleHashMap[bundleUrl] = hash;
  }

  registerManifestSource(
    manifestUrl: string,
    extractHashes: (manifest: any, manifestUrl: string) => Map<string, string>
  ): void {
    this.manifestSources.set(manifestUrl, {
      extractHashes,
    });
  }

  // --- Core loading ---

  /**
   * Load a bundle through the cache layer.
   *
   * - 'cache-hit': bundle loaded from disk cache (hash matched)
   * - 'downloaded': bundle freshly downloaded, verified, cached, and eval'd
   * - 'skipped': no expected hash, verification failed, or error — caller should fallback
   */
  async loadBundle(
    bundleUrl: string
  ): Promise<{ status: 'cache-hit' | 'downloaded' | 'skipped' }> {
    if (!NativeMFECache) return { status: 'skipped' };

    await this.ensureInitialized();

    try {
      // Strip query params for hash lookup
      const bundleUrlNoQuery = bundleUrl.split('?')[0];
      const expectedHash = this.bundleHashMap[bundleUrlNoQuery] as string | undefined;

      if (expectedHash) {
        return this.loadBundleWithVerification(bundleUrl, expectedHash);
      }

      // No hash — skip cache, fetch fresh. Serializer will compute hashes
      // for next load.
      console.info(`${LOG_PREFIX} skip (no hash): ${bundleUrlNoQuery}`);
      this.events.emit('bundle:load', {
        bundleUrl,
        remoteName: this.inferRemoteName(bundleUrl),
        status: 'skipped',
        hash: undefined,
        timestamp: Date.now(),
      });
      return { status: 'skipped' };
    } catch (cacheError) {
      console.warn(`${LOG_PREFIX} cache error, falling back to network:`, cacheError);
      return { status: 'skipped' };
    }
  }

  // --- Polling: manifest re-check and pre-download ---

  /**
   * Check all known manifests for updated bundles and pre-download them. Returns stats
   * about how many bundles were checked and updated.
   */
  async checkForUpdates(): Promise<{ updated: number; checked: number }> {
    if (!NativeMFECache || this.isCheckingUpdates) {
      return { updated: 0, checked: 0 };
    }

    this.isCheckingUpdates = true;
    this.events.emit('poll:start');
    let updated = 0;
    let checked = 0;

    try {
      await this.ensureInitialized();

      if (!this.manifestSources.size) return { updated: 0, checked: 0 };

      for (const [manifestUrl, source] of this.manifestSources) {
        try {
          const resp = await fetch(manifestUrl);
          if (!resp.ok) {
            console.warn(
              `${LOG_PREFIX} manifest fetch failed: ${manifestUrl} → HTTP ${resp.status}`
            );
            continue;
          }
          const manifest = await resp.json();

          // Extract all bundle URLs (container + exposed + shared) from manifest
          const newHashes = source.extractHashes(manifest, manifestUrl);

          for (const [bundleUrl, newHash] of newHashes) {
            checked++;
            // Check if this URL is already cached
            const existing = await this.cacheManager!.getCachedBundle(bundleUrl);
            if (existing) continue;

            // Not cached — pre-download
            const remoteName = this.inferRemoteName(bundleUrl);
            this.events.emit('update:available', {
              bundleUrl,
              remoteName,
              oldHash: undefined,
              newHash,
              timestamp: Date.now(),
            });
            const destPath = await this.cacheManager!.getBundleDestPath(
              remoteName,
              bundleUrl
            );

            try {
              const { sha256 } = await NativeMFECache!.downloadFile(bundleUrl, destPath);
              await this.cacheManager!.saveBundleToCache(remoteName, destPath, {
                bundleUrl,
                bundleHash: sha256,
              });
              updated++;
              this.events.emit('update:downloaded', {
                bundleUrl,
                remoteName,
                newHash: sha256,
                timestamp: Date.now(),
              });
            } catch (dlError) {
              console.warn(`${LOG_PREFIX} pre-download failed: ${bundleUrl}`, dlError);
              // Download failed for this bundle, continue with others
            }
          }
        } catch (manifestError) {
          console.warn(`${LOG_PREFIX} manifest error for ${manifestUrl}`, manifestError);
          // Non-critical: network error for this manifest, continue with others
        }
      }
    } finally {
      this.isCheckingUpdates = false;
      this.events.emit('poll:complete', {
        checked,
        updated,
        timestamp: Date.now(),
      });
    }

    return { updated, checked };
  }

  startPolling(intervalMs?: number): void {
    this.stopPolling();
    const interval = intervalMs ?? BundleCacheLayer.DEFAULT_POLL_INTERVAL_MS;
    this.pollTimer = setInterval(() => {
      this.checkForUpdates().catch(() => {});
    }, interval);
  }

  stopPolling(): void {
    if (this.pollTimer !== null) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  // --- Public API for UI layer ---

  async clearCache(): Promise<void> {
    await this.ensureInitialized();
    await this.cacheManager!.invalidateAllCaches();
  }

  getLoadedBundles(): BundleMetadata[] {
    return this.cacheManager?.getAllMetadata() ?? [];
  }

  // --- Private helpers ---

  private async loadBundleWithVerification(
    bundleUrl: string,
    expectedHash: string
  ): Promise<{ status: 'cache-hit' | 'downloaded' | 'skipped' }> {
    const cached = await this.cacheManager!.getCachedBundle(bundleUrl);

    const cacheValid =
      cached && cached.metadata.bundleHash && cached.metadata.bundleHash === expectedHash;

    if (cacheValid) {
      console.info(`${LOG_PREFIX} cache hit: ${bundleUrl.split('?')[0]}`);
      this.cacheManager!.updateLastUsedAt(bundleUrl).catch(() => {});
      await this.evalFromFile(cached.filePath);
      this.events.emit('bundle:load', {
        bundleUrl,
        remoteName: this.inferRemoteName(bundleUrl),
        status: 'cache-hit',
        hash: expectedHash,
        timestamp: Date.now(),
      });
      return { status: 'cache-hit' };
    }

    console.info(`${LOG_PREFIX} cache miss: ${bundleUrl.split('?')[0]}`);
    const remoteName = this.inferRemoteName(bundleUrl);
    const destPath = await this.cacheManager!.getBundleDestPath(remoteName, bundleUrl);
    const { sha256 } = await NativeMFECache!.downloadFile(bundleUrl, destPath);

    if (sha256 !== expectedHash) {
      try {
        await NativeMFECache!.deleteFile(destPath);
      } catch {
        /* ok */
      }
      this.events.emit('bundle:load', {
        bundleUrl,
        remoteName,
        status: 'skipped',
        hash: undefined,
        timestamp: Date.now(),
      });
      return { status: 'skipped' };
    }

    await this.cacheManager!.saveBundleToCache(remoteName, destPath, {
      bundleUrl,
      bundleHash: sha256,
    });
    await this.evalFromFile(destPath);
    this.events.emit('bundle:load', {
      bundleUrl,
      remoteName,
      status: 'downloaded',
      hash: sha256,
      timestamp: Date.now(),
    });
    return { status: 'downloaded' };
  }

  private async ensureInitialized(): Promise<void> {
    if (this.cacheManager) return;
    if (!this.initPromise) {
      this.initPromise = (async () => {
        const { enablePolling, pollIntervalMs, ...cacheConfig } = this.config;
        const cm = new CacheManager(cacheConfig);
        await cm.initialize();
        this.cacheManager = cm;
      })();
    }
    await this.initPromise;
  }

  /** Read bundle file and eval its source code */
  private evalFromFile(filePath: string): void | Promise<void> {
    if (typeof (globalThis as any).__MFE_readFileSync === 'function') {
      const source = (globalThis as any).__MFE_readFileSync(filePath);
      eval(source);
    } else {
      // Fallback: async read (less ideal — introduces a microtask gap)
      return NativeMFECache!.readFile(filePath, 'utf8').then((source: string) => {
        eval(source);
      });
    }
  }

  /** Infer a remote name from a bundle URL for storage path generation */
  private inferRemoteName(url: string): string {
    try {
      const parsed = new URL(url);
      const pathParts = parsed.pathname.replace(/^\/+/, '').split('/');
      if (pathParts.length > 0) {
        pathParts[pathParts.length - 1] = pathParts[pathParts.length - 1]
          .split('.')[0]
          .split('?')[0];
      }
      return pathParts.join('/') || 'unknown';
    } catch {
      const last = url.split('/').pop() ?? 'unknown';
      return last.split('.')[0].split('?')[0];
    }
  }
}
