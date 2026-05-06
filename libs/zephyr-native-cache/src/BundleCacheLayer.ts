import { CacheManager } from './CacheManager';
import { CacheEvents } from './events';
import NativeMFECache from './NativeMFECache';
import type {
  BundleMetadata,
  CacheStatusListener,
  CacheStatusSnapshot,
  CheckForUpdatesOptions,
  CheckForUpdatesResult,
  MFECacheConfig,
  UpdatePolicy,
} from './types';

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

  // Inflight dedup: prevents concurrent downloads of the same bundle URL
  private inflightLoads = new Map<
    string,
    Promise<{ status: 'cache-hit' | 'downloaded' | 'skipped' }>
  >();

  // Polling state
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private isCheckingUpdates = false;
  private static DEFAULT_POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

  // Event emitter for cache lifecycle events
  readonly events = new CacheEvents();

  // Public status snapshot for UI/hooks/integration tooling
  private status: CacheStatusSnapshot;
  private statusListeners = new Set<CacheStatusListener>();

  constructor(config: MFECacheConfig = {}) {
    this.config = config;

    // Share bundleHashMap via globalThis for cross-instance access
    this.bundleHashMap =
      (globalThis as any).__MFE_BUNDLE_HASHES__ ??
      ((globalThis as any).__MFE_BUNDLE_HASHES__ = {});

    this.status = {
      remotes: {},
      pollingEnabled: false,
      pollIntervalMs:
        this.config.pollIntervalMs ?? BundleCacheLayer.DEFAULT_POLL_INTERVAL_MS,
      isPolling: false,
      lastPollAt: undefined,
      lastPollResult: undefined,
      pendingUpdates: [],
    };
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

    const key = bundleUrl.split('?')[0];

    // Deduplicate concurrent loads of the same bundle
    const inflight = this.inflightLoads.get(key);
    if (inflight) return inflight;

    const load = this.doLoadBundle(bundleUrl, key);
    this.inflightLoads.set(key, load);
    try {
      return await load;
    } finally {
      this.inflightLoads.delete(key);
    }
  }

  private async doLoadBundle(
    bundleUrl: string,
    bundleUrlNoQuery: string
  ): Promise<{ status: 'cache-hit' | 'downloaded' | 'skipped' }> {
    try {
      const expectedHash = this.bundleHashMap[bundleUrlNoQuery] as string | undefined;

      if (expectedHash) {
        return this.loadBundleWithVerification(bundleUrl, expectedHash);
      }

      // No hash — skip cache, fetch fresh. Serializer will compute hashes
      // for next load.
      console.info(`${LOG_PREFIX} skip (no hash): ${bundleUrlNoQuery}`);
      this.recordBundleLoad(
        bundleUrl,
        this.inferRemoteName(bundleUrl),
        'skipped',
        undefined
      );
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
  async checkForUpdates(
    options: CheckForUpdatesOptions = {}
  ): Promise<CheckForUpdatesResult> {
    if (!NativeMFECache || this.isCheckingUpdates) {
      return { updated: 0, checked: 0, applied: false };
    }

    const policy: UpdatePolicy = options.policy ?? 'downloadOnly';
    this.isCheckingUpdates = true;
    this.status.isPolling = true;
    this.notifyStatusChange();
    this.events.emitPollStart();
    let updated = 0;
    let checked = 0;
    let applied = false;

    try {
      await this.ensureInitialized();

      if (!this.manifestSources.size) {
        return { updated: 0, checked: 0, applied: false };
      }

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

            // Update hash map so subsequent loadBundle() calls use the latest hash.
            // loadBundle() looks up by URL-without-query, so key consistently here too.
            this.bundleHashMap[bundleUrl.split('?')[0]] = newHash;

            const remoteName = this.inferRemoteName(bundleUrl);
            const didUpdate = await this.cacheManager!.preDownloadBundle(
              bundleUrl,
              newHash
            );
            if (didUpdate) {
              updated++;
              this.events.emitUpdateAvailable(bundleUrl, remoteName, undefined, newHash);
              if (!this.status.pendingUpdates.includes(remoteName)) {
                this.status.pendingUpdates = [...this.status.pendingUpdates, remoteName];
                this.notifyStatusChange();
              }
              this.events.emitUpdateDownloaded(bundleUrl, remoteName, newHash);
            }
          }
        } catch (manifestError) {
          console.warn(`${LOG_PREFIX} manifest error for ${manifestUrl}`, manifestError);
          // Non-critical: network error for this manifest, continue with others
        }
      }

      if (updated > 0 && policy === 'downloadAndApply') {
        applied = this.applyDownloadedUpdates();
        if (applied) {
          this.status.pendingUpdates = [];
          this.notifyStatusChange();
        }
      }
    } finally {
      this.isCheckingUpdates = false;
      this.status.isPolling = false;
      this.status.lastPollAt = Date.now();
      this.status.lastPollResult = { checked, updated };
      this.notifyStatusChange();
      this.events.emitPollComplete(checked, updated);
    }

    return { updated, checked, applied };
  }

  startPolling(intervalMs?: number): void {
    this.stopPolling();
    const interval = intervalMs ?? BundleCacheLayer.DEFAULT_POLL_INTERVAL_MS;
    this.status.pollingEnabled = true;
    this.status.pollIntervalMs = interval;
    this.notifyStatusChange();
    this.pollTimer = setInterval(() => {
      this.checkForUpdates().catch(() => {});
    }, interval);
  }

  stopPolling(): void {
    if (this.pollTimer !== null) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.status.pollingEnabled = false;
    this.status.isPolling = false;
    this.notifyStatusChange();
  }

  // --- Public API for UI layer ---

  async clearCache(): Promise<void> {
    await this.ensureInitialized();
    await this.cacheManager!.invalidateAllCaches();
  }

  getLoadedBundles(): BundleMetadata[] {
    return this.cacheManager?.getAllMetadata() ?? [];
  }

  getStatus(): CacheStatusSnapshot {
    return {
      remotes: { ...this.status.remotes },
      pollingEnabled: this.status.pollingEnabled,
      pollIntervalMs: this.status.pollIntervalMs,
      isPolling: this.status.isPolling,
      lastPollAt: this.status.lastPollAt,
      lastPollResult: this.status.lastPollResult
        ? { ...this.status.lastPollResult }
        : undefined,
      pendingUpdates: [...this.status.pendingUpdates],
    };
  }

  subscribeStatus(listener: CacheStatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.getStatus());
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  // --- Private helpers ---

  private notifyStatusChange(): void {
    const snapshot = this.getStatus();
    for (const listener of this.statusListeners) {
      listener(snapshot);
    }
  }

  private recordBundleLoad(
    bundleUrl: string,
    remoteName: string,
    status: 'cache-hit' | 'downloaded' | 'skipped',
    hash: string | undefined
  ): void {
    this.status.remotes[remoteName] = {
      remoteName,
      bundleUrl,
      status,
      hash,
      loadedAt: Date.now(),
    };
    if (status === 'cache-hit' || status === 'downloaded') {
      this.status.pendingUpdates = this.status.pendingUpdates.filter(
        (name) => name !== remoteName
      );
    }
    this.notifyStatusChange();
    this.events.emitBundleLoad(bundleUrl, remoteName, status, hash);
  }

  private applyDownloadedUpdates(): boolean {
    if (!NativeMFECache) return false;
    try {
      NativeMFECache.restart();
      return true;
    } catch (error) {
      console.warn(`${LOG_PREFIX} failed to apply downloaded updates`, error);
      return false;
    }
  }

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
      this.recordBundleLoad(
        bundleUrl,
        this.inferRemoteName(bundleUrl),
        'cache-hit',
        expectedHash
      );
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
      this.recordBundleLoad(bundleUrl, remoteName, 'skipped', undefined);
      return { status: 'skipped' };
    }

    await this.cacheManager!.saveBundleToCache(remoteName, destPath, {
      bundleUrl,
      bundleHash: sha256,
    });
    await this.evalFromFile(destPath);
    this.recordBundleLoad(bundleUrl, remoteName, 'downloaded', sha256);
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

  /**
   * Read bundle file and eval its source code. All callers `await` this, so the microtask
   * gap from the async read is not user-visible.
   */
  private async evalFromFile(filePath: string): Promise<void> {
    const source = await NativeMFECache!.readFile(filePath, 'utf8');
    // eslint-disable-next-line no-eval
    eval(source);
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
