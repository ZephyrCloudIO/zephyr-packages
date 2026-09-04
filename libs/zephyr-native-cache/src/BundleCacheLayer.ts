import { CacheManager, type VerifiedArtifact } from './CacheManager';
import { CacheEvents } from './events';
import { NativeCacheLoadError } from './NativeCacheError';
import NativeMFECache from './NativeMFECache';
import { getBundleCacheKey } from './cache-key';
import { normalizeSha256 } from './integrity';
import type {
  ArtifactOutcome,
  BundleLoadResult,
  BundleMetadata,
  CacheStatusListener,
  CacheStatusSnapshot,
  CheckForUpdatesOptions,
  CheckForUpdatesResult,
  ManifestOutcome,
  ManifestRelease,
  MFECacheConfig,
  NativeCacheFailureReason,
  UpdatePolicy,
} from './types';

interface ManifestSource {
  release: ManifestRelease;
  extractRelease: (manifest: unknown, manifestUrl: string) => ManifestRelease;
}

export class BundleCacheLayer {
  private cacheManager: CacheManager | null = null;
  private initPromise: Promise<void> | null = null;
  private config: MFECacheConfig;
  private releasesByBundle = new Map<string, ManifestRelease>();
  private releasesByManifest = new Map<string, ManifestRelease>();
  private lastRegisteredRelease: ManifestRelease | null = null;
  private manifestSources = new Map<string, ManifestSource>();
  private inflightLoads = new Map<string, Promise<BundleLoadResult>>();
  private operationTail: Promise<void> = Promise.resolve();
  private runtimePoisoned = false;

  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private isCheckingUpdates = false;
  private static DEFAULT_POLL_INTERVAL_MS = 5 * 60 * 1000;
  private static MANIFEST_FETCH_TIMEOUT_MS = 15_000;

  readonly events = new CacheEvents();
  private status: CacheStatusSnapshot;
  private statusListeners = new Set<CacheStatusListener>();

  constructor(config: MFECacheConfig = {}) {
    this.config = config;
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

  registerManifestRelease(release: ManifestRelease): void {
    const previous = this.releasesByManifest.get(release.manifestId);
    if (previous) {
      for (const artifact of previous.artifacts) {
        this.releasesByBundle.delete(getBundleCacheKey(artifact.bundleUrl));
      }
    }
    this.releasesByManifest.set(release.manifestId, release);
    this.lastRegisteredRelease = release;
    for (const artifact of release.artifacts) {
      this.releasesByBundle.set(getBundleCacheKey(artifact.bundleUrl), release);
    }
  }

  registerBundleHash(bundleUrl: string, hash: string): void {
    const remoteName = this.inferRemoteName(bundleUrl);
    this.registerManifestRelease({
      manifestId: `legacy:${remoteName}`,
      remoteName,
      artifacts: [{ bundleUrl, expectedHash: hash, kind: 'container' }],
    });
  }

  registerManifestSource(
    manifestUrl: string,
    extractRelease: (manifest: unknown, manifestUrl: string) => ManifestRelease,
    release: ManifestRelease | null = this.lastRegisteredRelease
  ): void {
    const registeredRelease = release ??
      Array.from(new Set(this.releasesByBundle.values())).find((candidate) =>
        candidate.artifacts.some((artifact) => artifact.bundleUrl.startsWith(manifestUrl))
      ) ?? {
        manifestId: manifestUrl,
        remoteName: this.inferRemoteName(manifestUrl),
        artifacts: [],
      };
    this.manifestSources.set(manifestUrl, { release: registeredRelease, extractRelease });
  }

  async loadBundle(bundleUrl: string): Promise<BundleLoadResult> {
    const key = getBundleCacheKey(bundleUrl);
    const inflight = this.inflightLoads.get(key);
    if (inflight) return inflight;

    const load = this.runExclusive(async () => {
      if (this.runtimePoisoned) {
        throw new NativeCacheLoadError(
          this.failureOutcome(bundleUrl, 'runtime-poisoned')
        );
      }
      if (!NativeMFECache) {
        throw new NativeCacheLoadError(
          this.failureOutcome(bundleUrl, 'native-unavailable')
        );
      }
      await this.ensureInitialized();
      return this.doLoadBundle(bundleUrl, key);
    });
    this.inflightLoads.set(key, load);
    try {
      return await load;
    } finally {
      this.inflightLoads.delete(key);
    }
  }

  async checkForUpdates(
    options: CheckForUpdatesOptions = {}
  ): Promise<CheckForUpdatesResult> {
    if (!NativeMFECache || this.isCheckingUpdates) {
      return { updated: 0, checked: 0, applied: false, outcomes: [] };
    }

    this.isCheckingUpdates = true;
    this.status.isPolling = true;
    this.notifyStatusChange();
    this.events.emitPollStart();

    return this.runExclusive(async () => {
      const policy: UpdatePolicy = options.policy ?? 'downloadOnly';
      let updated = 0;
      let checked = 0;
      let applied = false;
      const outcomes: ManifestOutcome[] = [];

      try {
        await this.ensureInitialized();
        for (const [manifestUrl, source] of this.manifestSources) {
          try {
            const controller = new AbortController();
            const timeout = setTimeout(
              () => controller.abort(),
              BundleCacheLayer.MANIFEST_FETCH_TIMEOUT_MS
            );
            let response: Response;
            try {
              response = await fetch(manifestUrl, { signal: controller.signal });
            } finally {
              clearTimeout(timeout);
            }
            if (!response.ok) {
              outcomes.push(this.failedPollOutcome(source.release, 'http-failure'));
              continue;
            }

            const release = source.extractRelease(await response.json(), manifestUrl);
            source.release = release;
            checked += release.artifacts.length;
            const outcome = await this.cacheManager!.stageGeneration(release);
            outcomes.push(outcome);
            if (outcome.status !== 'staged') continue;

            updated += release.artifacts.length;
            if (!this.status.pendingUpdates.includes(release.remoteName)) {
              this.status.pendingUpdates = [
                ...this.status.pendingUpdates,
                release.remoteName,
              ];
              this.notifyStatusChange();
            }
            for (const artifact of release.artifacts) {
              this.events.emitUpdateAvailable(
                artifact.bundleUrl,
                release.remoteName,
                undefined,
                artifact.expectedHash ?? ''
              );
              this.events.emitUpdateDownloaded(
                artifact.bundleUrl,
                release.remoteName,
                artifact.expectedHash ?? ''
              );
            }
          } catch (error) {
            const reason =
              error &&
              typeof error === 'object' &&
              'name' in error &&
              (error as { name?: unknown }).name === 'AbortError'
                ? 'timeout'
                : 'network-failure';
            outcomes.push(this.failedPollOutcome(source.release, reason));
          }
        }

        if (updated > 0 && policy === 'downloadAndApply') {
          this.status.pendingUpdates = [];
          this.notifyStatusChange();
          applied = this.applyDownloadedUpdates();
        }
      } finally {
        this.isCheckingUpdates = false;
        this.status.isPolling = false;
        this.status.lastPollAt = Date.now();
        this.status.lastPollResult = { checked, updated };
        this.notifyStatusChange();
        this.events.emitPollComplete(checked, updated);
      }

      return { updated, checked, applied, outcomes };
    });
  }

  startPolling(intervalMs?: number): void {
    this.stopPolling();
    const configuredInterval =
      intervalMs ??
      this.config.pollIntervalMs ??
      BundleCacheLayer.DEFAULT_POLL_INTERVAL_MS;
    const interval =
      Number.isFinite(configuredInterval) && configuredInterval >= 1_000
        ? configuredInterval
        : BundleCacheLayer.DEFAULT_POLL_INTERVAL_MS;
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
    this.notifyStatusChange();
  }

  async clearCache(): Promise<void> {
    await this.runExclusive(async () => {
      await this.ensureInitialized();
      await this.cacheManager!.invalidateAllCaches();
    });
  }

  async rollback(remoteNameOrManifestId: string): Promise<ManifestOutcome> {
    return this.runExclusive(async () => {
      await this.ensureInitialized();
      const outcome = await this.cacheManager!.rollbackGeneration(remoteNameOrManifestId);
      if (outcome.status === 'rolled-back') {
        this.status.pendingUpdates = this.status.pendingUpdates.filter(
          (name) => name !== outcome.remoteName
        );
        this.notifyStatusChange();
      }
      return outcome;
    });
  }

  getLoadedBundles(): BundleMetadata[] {
    return this.cacheManager?.getAllMetadata() ?? [];
  }

  getStatus(): CacheStatusSnapshot {
    return {
      remotes: Object.fromEntries(
        Object.entries(this.status.remotes).map(([key, remote]) => [key, { ...remote }])
      ),
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
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  private async doLoadBundle(bundleUrl: string, key: string): Promise<BundleLoadResult> {
    const release = this.releasesByBundle.get(key);
    const artifact = release?.artifacts.find(
      (candidate) => getBundleCacheKey(candidate.bundleUrl) === key
    );
    const expectedHash = normalizeSha256(artifact?.expectedHash);

    let active: VerifiedArtifact | null = null;
    try {
      active = await this.cacheManager!.getVerifiedActiveBundle(
        bundleUrl,
        release?.manifestId
      );
    } catch {
      const recovered = await this.recoverPrevious(bundleUrl, release, 'corrupt-cache');
      if (recovered) return recovered;
      try {
        await this.cacheManager!.discardActiveGenerationForBundle(bundleUrl);
      } catch {
        throw new NativeCacheLoadError(
          this.failureOutcome(bundleUrl, 'storage-failure', release)
        );
      }
    }

    if (!release || !artifact) {
      if (active && !this.releasesByManifest.has(active.generation.manifestId)) {
        try {
          return await this.evaluateKnownGood(bundleUrl, active);
        } catch {
          await this.rollbackAfterEvaluationFailure(active.generation.manifestId);
          throw new NativeCacheLoadError(
            this.failureOutcome(bundleUrl, 'evaluation-failure')
          );
        }
      }
      throw new NativeCacheLoadError(this.failureOutcome(bundleUrl, 'missing-hash'));
    }

    if (!expectedHash) {
      const reason: NativeCacheFailureReason =
        artifact.expectedHash == null || artifact.expectedHash === ''
          ? 'missing-hash'
          : 'malformed-hash';
      throw new NativeCacheLoadError(this.failureOutcome(bundleUrl, reason, release));
    }

    if (active?.artifact.bundleHash === expectedHash) {
      try {
        return await this.evaluateKnownGood(bundleUrl, active);
      } catch {
        await this.rollbackAfterEvaluationFailure(release.manifestId);
        throw new NativeCacheLoadError(
          this.failureOutcome(bundleUrl, 'evaluation-failure', release)
        );
      }
    }

    const staged = await this.cacheManager!.stageGeneration(release);
    if (staged.status === 'failed') {
      if (active) {
        try {
          const result = await this.evaluateKnownGood(bundleUrl, active);
          result.candidateOutcome =
            staged.artifacts.find((outcome) => outcome.bundleUrl === key) ??
            this.failureOutcome(bundleUrl, staged.reason ?? 'storage-failure', release);
          return result;
        } catch {
          await this.rollbackAfterEvaluationFailure(active.generation.manifestId);
          throw new NativeCacheLoadError(
            this.failureOutcome(bundleUrl, 'evaluation-failure', release)
          );
        }
      }
      throw new NativeCacheLoadError(
        staged.artifacts.find((outcome) => outcome.bundleUrl === key) ??
          this.failureOutcome(bundleUrl, staged.reason ?? 'storage-failure', release)
      );
    }

    let stagedArtifacts: VerifiedArtifact[];
    try {
      stagedArtifacts = await this.cacheManager!.getVerifiedStagedGeneration(
        release.manifestId
      );
      if (stagedArtifacts.length !== release.artifacts.length) {
        throw new Error('Staged generation is incomplete');
      }
      for (const stagedArtifact of stagedArtifacts) {
        await this.validateSource(
          stagedArtifact.artifact.bundleUrl,
          stagedArtifact.source
        );
      }
    } catch {
      try {
        await this.cacheManager!.rejectStagedGeneration(
          release.manifestId,
          'evaluation-failure'
        );
      } catch {
        // The candidate remains inert when cleanup persistence fails.
      }
      if (active) {
        try {
          const result = await this.evaluateKnownGood(bundleUrl, active);
          result.candidateOutcome = this.failureOutcome(
            bundleUrl,
            'evaluation-failure',
            release
          );
          return result;
        } catch {
          await this.rollbackAfterEvaluationFailure(active.generation.manifestId);
        }
      }
      throw new NativeCacheLoadError(
        this.failureOutcome(bundleUrl, 'evaluation-failure', release)
      );
    }

    const candidate = stagedArtifacts.find(
      (item) =>
        item.artifact.bundleUrl === key && item.artifact.bundleHash === expectedHash
    );
    if (!candidate) {
      throw new NativeCacheLoadError(
        this.failureOutcome(bundleUrl, 'storage-failure', release)
      );
    }

    try {
      await this.evalSource(candidate.source);
    } catch {
      try {
        await this.cacheManager!.rejectStagedGeneration(
          release.manifestId,
          'evaluation-failure'
        );
      } catch {
        // Preserve the evaluation failure; the staged generation is still inactive.
      }
      this.restartAfterRejectedExecution();
      throw new NativeCacheLoadError(
        this.failureOutcome(bundleUrl, 'evaluation-failure', release)
      );
    }

    const activation = await this.cacheManager!.activateStagedGeneration(
      release.manifestId
    );
    if (activation.status !== 'activated') {
      this.restartAfterRejectedExecution();
      throw new NativeCacheLoadError(
        this.failureOutcome(bundleUrl, 'activation-failure', release)
      );
    }

    const outcome =
      activation.artifacts.find((item) => item.bundleUrl === key) ??
      this.failureOutcome(bundleUrl, 'activation-failure', release);
    this.recordBundleLoad(bundleUrl, release.remoteName, 'downloaded', expectedHash);
    return { status: 'downloaded', outcome };
  }

  private async evaluateKnownGood(
    bundleUrl: string,
    verified: VerifiedArtifact
  ): Promise<BundleLoadResult> {
    await this.validateSource(bundleUrl, verified.source);
    await this.evalSource(verified.source);
    const outcome: ArtifactOutcome = {
      manifestId: verified.generation.manifestId,
      remoteName: verified.generation.remoteName,
      bundleUrl: verified.artifact.bundleUrl,
      status: 'cache-hit',
      generationId: verified.generation.generationId,
    };
    this.recordBundleLoad(
      bundleUrl,
      verified.generation.remoteName,
      'cache-hit',
      verified.artifact.bundleHash
    );
    return { status: 'cache-hit', outcome };
  }

  private async recoverPrevious(
    bundleUrl: string,
    release: ManifestRelease | undefined,
    reason: NativeCacheFailureReason
  ): Promise<BundleLoadResult | null> {
    let previous: VerifiedArtifact | null;
    let rollback: ManifestOutcome;
    try {
      previous = await this.cacheManager!.getVerifiedPreviousBundle(
        bundleUrl,
        release?.manifestId
      );
      if (!previous) return null;
      await this.validateSource(bundleUrl, previous.source);
      rollback = await this.cacheManager!.rollbackGeneration(
        previous.generation.manifestId
      );
      if (rollback.status !== 'rolled-back') return null;
    } catch {
      return null;
    }

    try {
      await this.evalSource(previous.source);
      const outcome =
        rollback.artifacts.find(
          (item) => item.bundleUrl === getBundleCacheKey(bundleUrl)
        ) ?? rollback.artifacts[0];
      this.recordBundleLoad(
        bundleUrl,
        previous.generation.remoteName,
        'cache-hit',
        previous.artifact.bundleHash
      );
      return {
        status: 'cache-hit',
        outcome,
        candidateOutcome: this.failureOutcome(bundleUrl, reason, release),
      };
    } catch {
      this.restartAfterRejectedExecution();
      throw new NativeCacheLoadError(
        this.failureOutcome(bundleUrl, 'rollback-failure', release)
      );
    }
  }

  private async rollbackAfterEvaluationFailure(manifestId: string): Promise<void> {
    try {
      await this.cacheManager!.rejectActiveGenerationAndRollback(
        manifestId,
        'evaluation-failure'
      );
    } finally {
      this.restartAfterRejectedExecution();
    }
  }

  private async validateSource(bundleUrl: string, source: string): Promise<void> {
    if (this.config.validateBundle) {
      await this.config.validateBundle(bundleUrl, source);
      return;
    }
    // Compile without invoking the bundle so every staged artifact receives a
    // side-effect-free syntax smoke check before generation promotion.
    Function(source);
  }

  private async evalSource(source: string): Promise<void> {
    // eslint-disable-next-line no-eval
    eval(source);
  }

  private restartAfterRejectedExecution(): void {
    this.runtimePoisoned = true;
    try {
      NativeMFECache?.restart();
    } catch {
      // The typed load failure still prevents further candidate execution.
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (this.cacheManager) return;
    if (!this.initPromise) {
      const initialization = (async () => {
        const {
          enablePolling,
          pollIntervalMs,
          forceCacheInDev,
          validateBundle,
          ...cacheConfig
        } = this.config;
        const manager = new CacheManager(cacheConfig);
        await manager.initialize();
        this.cacheManager = manager;
      })();
      this.initPromise = initialization;
    }
    try {
      await this.initPromise;
    } catch (error) {
      this.initPromise = null;
      throw error;
    }
  }

  private runExclusive<T>(operation: () => Promise<T>): Promise<T> {
    const run = this.operationTail.then(operation, operation);
    this.operationTail = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }

  private notifyStatusChange(): void {
    const snapshot = this.getStatus();
    for (const listener of this.statusListeners) {
      try {
        listener(snapshot);
      } catch {
        console.warn('[MFE-Cache] status listener failed');
      }
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
    } catch {
      console.warn('[MFE-Cache] failed to apply downloaded updates');
      return false;
    }
  }

  private failureOutcome(
    bundleUrl: string,
    reason: NativeCacheFailureReason,
    release?: ManifestRelease
  ): ArtifactOutcome {
    const remoteName = release?.remoteName ?? this.inferRemoteName(bundleUrl);
    return {
      manifestId: release?.manifestId ?? remoteName,
      remoteName,
      bundleUrl: getBundleCacheKey(bundleUrl),
      status: 'failed',
      reason,
    };
  }

  private failedPollOutcome(
    release: ManifestRelease,
    reason: NativeCacheFailureReason
  ): ManifestOutcome {
    return {
      manifestId: release.manifestId,
      remoteName: release.remoteName,
      status: 'failed',
      reason,
      artifacts: release.artifacts.map((artifact) =>
        this.failureOutcome(artifact.bundleUrl, reason, release)
      ),
    };
  }

  private inferRemoteName(url: string): string {
    try {
      return (
        new URL(url).pathname.split('/').filter(Boolean).pop()?.split('.')[0] ?? 'unknown'
      );
    } catch {
      return 'unknown';
    }
  }
}
