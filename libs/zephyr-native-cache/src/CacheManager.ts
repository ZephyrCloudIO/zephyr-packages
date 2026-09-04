import NativeMFECache from './NativeMFECache';
import { getBundleCacheKey } from './cache-key';
import { normalizeSha256 } from './integrity';
import type {
  ArtifactOutcome,
  BundleMetadata,
  CachedBundleResult,
  ManifestArtifact,
  ManifestOutcome,
  ManifestRelease,
  MFECacheConfig,
  NativeCacheFailureReason,
} from './types';

interface GenerationArtifact {
  bundleUrl: string;
  bundleHash: string;
  filePath: string;
  kind: ManifestArtifact['kind'];
  downloadedAt: number;
  lastUsedAt: number;
}

interface Generation {
  manifestId: string;
  remoteName: string;
  generationId: string;
  rootPath: string;
  createdAt: number;
  artifacts: GenerationArtifact[];
}

interface CacheState {
  schemaVersion: 2;
  active: Record<string, Generation>;
  previous: Record<string, Generation>;
  staged: Record<string, Generation>;
  rejected: Record<string, { generationId: string; reason: NativeCacheFailureReason }>;
}

interface StoredGeneration extends Omit<Generation, 'rootPath' | 'artifacts'> {
  rootPath: string;
  artifacts: Array<Omit<GenerationArtifact, 'filePath'> & { filePath: string }>;
}

interface StoredCacheState {
  schemaVersion: 2;
  active: Record<string, StoredGeneration>;
  previous: Record<string, StoredGeneration>;
  staged: Record<string, StoredGeneration>;
  rejected: CacheState['rejected'];
}

export interface VerifiedArtifact {
  generation: Generation;
  artifact: GenerationArtifact;
  source: string;
}

const EMPTY_STATE = (): CacheState => ({
  schemaVersion: 2,
  active: {},
  previous: {},
  staged: {},
  rejected: {},
});

function failureReason(error: unknown): NativeCacheFailureReason {
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: unknown }).code)
      : '';
  if (code === 'HASH_MISMATCH') return 'corrupt-cache';
  if (code === 'DOWNLOAD_TIMEOUT' || code === 'ETIMEDOUT') return 'timeout';
  if (code === 'HTTP_ERROR') return 'http-failure';
  if (code === 'DOWNLOAD_ERROR' || code === 'NETWORK_ERROR') return 'network-failure';
  if (code === 'STORAGE_ERROR') return 'storage-failure';
  return 'storage-failure';
}

export class CacheManager {
  private bundleDir = '';
  private config: MFECacheConfig;
  private state: CacheState = EMPTY_STATE();
  private initialized = false;

  constructor(config: MFECacheConfig = {}) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    if (!NativeMFECache) {
      throw new Error('Native cache module is unavailable');
    }

    const cacheDir = await NativeMFECache.getCacheDirectory();
    this.bundleDir = this.config.bundleDir ?? `${cacheDir}/mfe-bundles`;
    await this.recoverState();
    this.initialized = true;
  }

  async stageGeneration(release: ManifestRelease): Promise<ManifestOutcome> {
    this.assertInitialized();
    if (release.artifacts.length === 0) {
      return this.failedManifest(release, 'missing-hash', []);
    }
    const invalid = this.findInvalidArtifact(release);
    if (invalid) {
      return this.failedManifest(release, invalid.reason!, [invalid]);
    }

    const artifacts = release.artifacts.map((artifact) => ({
      ...artifact,
      bundleUrl: getBundleCacheKey(artifact.bundleUrl),
      expectedHash: normalizeSha256(artifact.expectedHash)!,
    }));
    const generationId = await NativeMFECache!.sha256String(
      JSON.stringify(
        artifacts
          .map(({ bundleUrl, expectedHash, kind }) => ({
            bundleUrl,
            expectedHash,
            kind,
          }))
          .sort((a, b) => a.bundleUrl.localeCompare(b.bundleUrl))
      )
    );

    const active = this.state.active[release.manifestId];
    if (active?.generationId === generationId) {
      return this.manifestOutcome('unchanged', active, 'cache-hit');
    }

    const rejected = this.state.rejected[release.manifestId];
    if (rejected?.generationId === generationId) {
      return this.failedManifest(
        release,
        rejected.reason,
        artifacts.map((artifact) =>
          this.artifactOutcome(
            release,
            artifact.bundleUrl,
            'failed',
            generationId,
            rejected.reason
          )
        )
      );
    }

    const existingStage = this.state.staged[release.manifestId];
    if (existingStage?.generationId === generationId) {
      try {
        await this.verifyGeneration(existingStage);
        return this.manifestOutcome('unchanged', existingStage, 'staged');
      } catch {
        await this.removeGenerationFromState('staged', release.manifestId);
      }
    }

    const stageRoot = `${this.bundleDir}/staging/${generationId}.${Date.now()}`;
    const stagedArtifacts: GenerationArtifact[] = [];
    try {
      for (const artifact of artifacts) {
        const artifactId = await NativeMFECache!.sha256String(artifact.bundleUrl);
        const filePath = `${stageRoot}/${artifactId}.bundle`;
        const downloaded = await NativeMFECache!.downloadFile(
          artifact.bundleUrl,
          filePath
        );
        if (downloaded.sha256.toLowerCase() !== artifact.expectedHash) {
          throw Object.assign(new Error('Downloaded bundle integrity check failed'), {
            code: 'HASH_MISMATCH',
            bundleUrl: artifact.bundleUrl,
          });
        }
        const storedHash = (await NativeMFECache!.sha256File(filePath)).toLowerCase();
        if (storedHash !== artifact.expectedHash) {
          throw Object.assign(new Error('Staged bundle integrity check failed'), {
            code: 'HASH_MISMATCH',
            bundleUrl: artifact.bundleUrl,
          });
        }
        const now = Date.now();
        stagedArtifacts.push({
          bundleUrl: artifact.bundleUrl,
          bundleHash: artifact.expectedHash,
          filePath,
          kind: artifact.kind,
          downloadedAt: now,
          lastUsedAt: now,
        });
      }

      const generation: Generation = {
        manifestId: release.manifestId,
        remoteName: release.remoteName,
        generationId,
        rootPath: stageRoot,
        createdAt: Date.now(),
        artifacts: stagedArtifacts,
      };
      const next = this.copyState();
      const replacedStage = next.staged[release.manifestId];
      next.staged[release.manifestId] = generation;
      delete next.rejected[release.manifestId];
      await this.persistState(next);
      this.state = next;
      if (replacedStage && replacedStage.rootPath !== generation.rootPath) {
        await this.deleteGeneration(replacedStage);
      }
      return this.manifestOutcome('staged', generation, 'staged');
    } catch (error) {
      await this.deletePath(stageRoot);
      const reason =
        error &&
        typeof error === 'object' &&
        'code' in error &&
        (error as { code?: unknown }).code === 'HASH_MISMATCH'
          ? 'hash-mismatch'
          : failureReason(error);
      return this.failedManifest(
        release,
        reason,
        artifacts.map((artifact) =>
          this.artifactOutcome(
            release,
            artifact.bundleUrl,
            'failed',
            generationId,
            reason
          )
        )
      );
    }
  }

  async getVerifiedActiveBundle(
    bundleUrl: string,
    manifestId?: string
  ): Promise<VerifiedArtifact | null> {
    return this.getVerifiedBundle(this.state.active, bundleUrl, manifestId);
  }

  async getVerifiedPreviousBundle(
    bundleUrl: string,
    manifestId?: string
  ): Promise<VerifiedArtifact | null> {
    return this.getVerifiedBundle(this.state.previous, bundleUrl, manifestId);
  }

  async getVerifiedStagedBundle(
    bundleUrl: string,
    expectedHash: string
  ): Promise<VerifiedArtifact | null> {
    const verified = await this.getVerifiedBundle(this.state.staged, bundleUrl);
    return verified?.artifact.bundleHash === expectedHash ? verified : null;
  }

  async getVerifiedStagedGeneration(manifestId: string): Promise<VerifiedArtifact[]> {
    const generation = this.state.staged[manifestId];
    if (!generation) return [];
    const verified: VerifiedArtifact[] = [];
    for (const artifact of generation.artifacts) {
      const { source } = await NativeMFECache!.readVerifiedFile(
        artifact.filePath,
        artifact.bundleHash
      );
      verified.push({ generation, artifact, source });
    }
    return verified;
  }

  async activateStagedGeneration(manifestId: string): Promise<ManifestOutcome> {
    this.assertInitialized();
    const candidate = this.state.staged[manifestId];
    if (!candidate) {
      throw new Error('No staged generation is available');
    }

    try {
      await this.verifyGeneration(candidate);
      const next = this.copyState();
      const supersededPrevious = next.previous[manifestId];
      const current = next.active[manifestId];
      if (current) next.previous[manifestId] = current;
      else delete next.previous[manifestId];
      next.active[manifestId] = candidate;
      delete next.staged[manifestId];
      await this.persistState(next);
      this.state = next;
      if (
        supersededPrevious &&
        supersededPrevious.rootPath !== current?.rootPath &&
        supersededPrevious.rootPath !== candidate.rootPath
      ) {
        await this.deleteGeneration(supersededPrevious);
      }
      return this.manifestOutcome('activated', candidate, 'activated');
    } catch {
      try {
        await this.rejectStagedGeneration(manifestId, 'activation-failure');
      } catch {
        // The candidate remains inert because the active pointer was not changed.
      }
      const release = this.releaseFromGeneration(candidate);
      return this.failedManifest(
        release,
        'activation-failure',
        release.artifacts.map((artifact) =>
          this.artifactOutcome(
            release,
            artifact.bundleUrl,
            'failed',
            candidate.generationId,
            'activation-failure'
          )
        )
      );
    }
  }

  async discardStagedGeneration(manifestId: string): Promise<void> {
    await this.removeGenerationFromState('staged', manifestId);
  }

  async rejectStagedGeneration(
    manifestId: string,
    reason: NativeCacheFailureReason
  ): Promise<void> {
    const generation = this.state.staged[manifestId];
    if (!generation) return;
    const next = this.copyState();
    delete next.staged[manifestId];
    next.rejected[manifestId] = {
      generationId: generation.generationId,
      reason,
    };
    await this.persistState(next);
    this.state = next;
    await this.deleteGeneration(generation);
  }

  async discardActiveGenerationForBundle(bundleUrl: string): Promise<void> {
    const key = getBundleCacheKey(bundleUrl);
    const entry = Object.entries(this.state.active).find(([, generation]) =>
      generation.artifacts.some((artifact) => artifact.bundleUrl === key)
    );
    if (!entry) return;
    await this.removeGenerationFromState('active', entry[0]);
  }

  async rollbackGeneration(remoteNameOrManifestId: string): Promise<ManifestOutcome> {
    this.assertInitialized();
    const manifestId =
      this.findManifestId(this.state.previous, remoteNameOrManifestId) ??
      remoteNameOrManifestId;
    const previous = this.state.previous[manifestId];
    if (!previous) {
      return {
        manifestId,
        remoteName: remoteNameOrManifestId,
        status: 'failed',
        reason: 'rollback-failure',
        artifacts: [],
      };
    }

    try {
      await this.verifyGeneration(previous);
      const next = this.copyState();
      const current = next.active[manifestId];
      next.active[manifestId] = previous;
      if (current) next.previous[manifestId] = current;
      else delete next.previous[manifestId];
      await this.persistState(next);
      this.state = next;
      return this.manifestOutcome('rolled-back', previous, 'rolled-back');
    } catch {
      return this.failedManifest(
        this.releaseFromGeneration(previous),
        'rollback-failure',
        []
      );
    }
  }

  async rejectActiveGenerationAndRollback(
    manifestId: string,
    reason: NativeCacheFailureReason
  ): Promise<ManifestOutcome> {
    this.assertInitialized();
    const failed = this.state.active[manifestId];
    if (!failed) {
      return {
        manifestId,
        remoteName: manifestId,
        status: 'failed',
        reason: 'rollback-failure',
        artifacts: [],
      };
    }

    const next = this.copyState();
    const previous = next.previous[manifestId];
    next.rejected[manifestId] = {
      generationId: failed.generationId,
      reason,
    };
    if (previous) next.active[manifestId] = previous;
    else delete next.active[manifestId];
    delete next.previous[manifestId];

    try {
      if (previous) await this.verifyGeneration(previous);
      await this.persistState(next);
      this.state = next;
      await this.deleteGeneration(failed);
      return previous
        ? this.manifestOutcome('rolled-back', previous, 'rolled-back')
        : this.failedManifest(this.releaseFromGeneration(failed), 'rollback-failure', []);
    } catch {
      return this.failedManifest(
        this.releaseFromGeneration(failed),
        'rollback-failure',
        []
      );
    }
  }

  async invalidateAllCaches(): Promise<void> {
    this.assertInitialized();
    const empty = EMPTY_STATE();
    await this.persistState(empty);
    this.state = empty;
    await this.deletePath(`${this.bundleDir}/staging`);
    await this.deletePath(`${this.bundleDir}/generations`);
  }

  getAllMetadata(): BundleMetadata[] {
    return Object.values(this.state.active).flatMap((generation) =>
      generation.artifacts.map((artifact) => ({
        remoteName: generation.remoteName,
        bundleHash: artifact.bundleHash,
        buildVersion: generation.generationId,
        filePath: artifact.filePath,
        bundleUrl: artifact.bundleUrl,
        downloadedAt: artifact.downloadedAt,
        lastUsedAt: artifact.lastUsedAt,
        status: 'active' as const,
        retryCount: 0,
        lastRetryAt: null,
      }))
    );
  }

  async getCachedBundle(bundleUrl: string): Promise<CachedBundleResult | null> {
    const key = getBundleCacheKey(bundleUrl);
    for (const generation of Object.values(this.state.active)) {
      const artifact = generation.artifacts.find((item) => item.bundleUrl === key);
      if (artifact) {
        return {
          source: 'disk',
          filePath: artifact.filePath,
          metadata: this.getAllMetadata().find(
            (item) => item.filePath === artifact.filePath
          )!,
        };
      }
    }
    return null;
  }

  async getBundleDestPath(
    remoteName: string,
    bundleUrl: string,
    bundleHash?: string
  ): Promise<string> {
    this.assertInitialized();
    const artifactId = await NativeMFECache!.sha256String(getBundleCacheKey(bundleUrl));
    const hash = normalizeSha256(bundleHash) ?? 'unverified';
    return `${this.bundleDir}/staging/${this.sanitize(remoteName)}/${artifactId}.${hash}.bundle`;
  }

  async saveBundleToCache(
    remoteName: string,
    filePath: string,
    metadata: { bundleUrl: string; bundleHash?: string; buildVersion?: string }
  ): Promise<BundleMetadata> {
    this.assertInitialized();
    const hash = normalizeSha256(metadata.bundleHash);
    if (!hash) throw new Error('A valid SHA-256 is required');
    await NativeMFECache!.readVerifiedFile(filePath, hash);
    const release: ManifestRelease = {
      manifestId: `legacy:${remoteName}`,
      remoteName,
      artifacts: [
        { bundleUrl: metadata.bundleUrl, expectedHash: hash, kind: 'container' },
      ],
    };
    const generation: Generation = {
      manifestId: release.manifestId,
      remoteName,
      generationId: metadata.buildVersion ?? hash,
      rootPath: filePath.slice(0, filePath.lastIndexOf('/')),
      createdAt: Date.now(),
      artifacts: [
        {
          bundleUrl: getBundleCacheKey(metadata.bundleUrl),
          bundleHash: hash,
          filePath,
          kind: 'container',
          downloadedAt: Date.now(),
          lastUsedAt: Date.now(),
        },
      ],
    };
    const next = this.copyState();
    next.staged[release.manifestId] = generation;
    await this.persistState(next);
    this.state = next;
    const activated = await this.activateStagedGeneration(release.manifestId);
    if (activated.status !== 'activated') throw new Error('Bundle activation failed');
    return this.getAllMetadata().find((item) => item.filePath === filePath)!;
  }

  async preDownloadBundle(bundleUrl: string, newHash: string): Promise<boolean> {
    const remoteName = this.inferRemoteName(bundleUrl);
    const outcome = await this.stageGeneration({
      manifestId: `legacy:${remoteName}`,
      remoteName,
      artifacts: [{ bundleUrl, expectedHash: newHash, kind: 'container' }],
    });
    return outcome.status === 'staged';
  }

  async updateLastUsedAt(bundleUrl: string): Promise<void> {
    const key = getBundleCacheKey(bundleUrl);
    for (const generation of Object.values(this.state.active)) {
      const artifact = generation.artifacts.find((item) => item.bundleUrl === key);
      if (artifact) artifact.lastUsedAt = Date.now();
    }
  }

  async removeAll(remoteName: string): Promise<void> {
    const ids = new Set<string>();
    for (const group of [this.state.active, this.state.previous, this.state.staged]) {
      for (const generation of Object.values(group)) {
        if (generation.remoteName === remoteName) ids.add(generation.manifestId);
      }
    }
    if (!ids.size) return;
    const next = this.copyState();
    const removed: Generation[] = [];
    for (const id of ids) {
      for (const group of [next.active, next.previous, next.staged]) {
        if (group[id]) removed.push(group[id]);
        delete group[id];
      }
    }
    await this.persistState(next);
    this.state = next;
    for (const generation of removed) await this.deleteGeneration(generation);
  }

  async evictLRU(): Promise<void> {
    // Active and previous generations are intentionally protected from LRU eviction.
  }

  private get statePath(): string {
    return `${this.bundleDir}/state-v2.json`;
  }

  private assertInitialized(): void {
    if (!this.initialized || !NativeMFECache) {
      throw new Error('CacheManager must be initialized before use');
    }
  }

  private copyState(): CacheState {
    return {
      schemaVersion: 2,
      active: { ...this.state.active },
      previous: { ...this.state.previous },
      staged: { ...this.state.staged },
      rejected: { ...this.state.rejected },
    };
  }

  private findInvalidArtifact(release: ManifestRelease): ArtifactOutcome | null {
    for (const artifact of release.artifacts) {
      if (artifact.expectedHash == null || artifact.expectedHash === '') {
        return this.artifactOutcome(
          release,
          artifact.bundleUrl,
          'failed',
          undefined,
          'missing-hash'
        );
      }
      if (!normalizeSha256(artifact.expectedHash)) {
        return this.artifactOutcome(
          release,
          artifact.bundleUrl,
          'failed',
          undefined,
          'malformed-hash'
        );
      }
    }
    return null;
  }

  private async getVerifiedBundle(
    generations: Record<string, Generation>,
    bundleUrl: string,
    manifestId?: string
  ): Promise<VerifiedArtifact | null> {
    const key = getBundleCacheKey(bundleUrl);
    const matches = (
      manifestId ? [generations[manifestId]].filter(Boolean) : Object.values(generations)
    ).flatMap((generation) => {
      const artifact = generation.artifacts.find((item) => item.bundleUrl === key);
      return artifact ? [{ generation, artifact }] : [];
    });
    if (matches.length > 1) {
      throw new Error('Bundle URL belongs to multiple cached manifests');
    }
    const match = matches[0];
    if (!match) return null;
    const { source } = await NativeMFECache!.readVerifiedFile(
      match.artifact.filePath,
      match.artifact.bundleHash
    );
    match.artifact.lastUsedAt = Date.now();
    return { ...match, source };
  }

  private async verifyGeneration(generation: Generation): Promise<void> {
    for (const artifact of generation.artifacts) {
      await NativeMFECache!.readVerifiedFile(artifact.filePath, artifact.bundleHash);
    }
  }

  private async persistState(state: CacheState): Promise<void> {
    const stored: StoredCacheState = {
      schemaVersion: 2,
      active: this.serializeGenerations(state.active),
      previous: this.serializeGenerations(state.previous),
      staged: this.serializeGenerations(state.staged),
      rejected: state.rejected,
    };
    await NativeMFECache!.writeFile(this.statePath, JSON.stringify(stored), 'utf8');
  }

  private serializeGenerations(
    generations: Record<string, Generation>
  ): Record<string, StoredGeneration> {
    return Object.fromEntries(
      Object.entries(generations).map(([key, generation]) => [
        key,
        {
          ...generation,
          rootPath: this.relativePath(generation.rootPath),
          artifacts: generation.artifacts.map((artifact) => ({
            ...artifact,
            filePath: this.relativePath(artifact.filePath),
          })),
        },
      ])
    );
  }

  private async recoverState(): Promise<void> {
    if (!(await NativeMFECache!.fileExists(this.statePath))) return;
    try {
      const raw = await NativeMFECache!.readFile(this.statePath, 'utf8');
      const stored = JSON.parse(raw) as Partial<StoredCacheState>;
      if (
        stored.schemaVersion !== 2 ||
        !stored.active ||
        !stored.previous ||
        !stored.staged
      ) {
        return;
      }
      const recovered: CacheState = {
        schemaVersion: 2,
        active: await this.deserializeGenerations(stored.active),
        previous: await this.deserializeGenerations(stored.previous),
        staged: await this.deserializeGenerations(stored.staged),
        rejected: this.validRejectedGenerations(stored.rejected),
      };
      let repaired = false;
      for (const [manifestId, previous] of Object.entries(recovered.previous)) {
        if (!recovered.active[manifestId]) {
          recovered.active[manifestId] = previous;
          delete recovered.previous[manifestId];
          repaired = true;
        }
      }
      this.state = recovered;
      const recoveredCount =
        Object.keys(recovered.active).length +
        Object.keys(recovered.previous).length +
        Object.keys(recovered.staged).length;
      const storedCount =
        Object.keys(stored.active).length +
        Object.keys(stored.previous).length +
        Object.keys(stored.staged).length;
      if (repaired || recoveredCount !== storedCount) {
        await this.persistState(recovered);
      }
    } catch {
      this.state = EMPTY_STATE();
    }
  }

  private async deserializeGenerations(
    stored: Record<string, StoredGeneration>
  ): Promise<Record<string, Generation>> {
    const recovered: Record<string, Generation> = {};
    for (const [key, generation] of Object.entries(stored)) {
      if (!this.validStoredGeneration(key, generation)) continue;
      const restored: Generation = {
        ...generation,
        rootPath: `${this.bundleDir}/${generation.rootPath}`,
        artifacts: generation.artifacts.map((artifact) => ({
          ...artifact,
          filePath: `${this.bundleDir}/${artifact.filePath}`,
        })),
      };
      const filesExist = await Promise.all(
        restored.artifacts.map((artifact) =>
          NativeMFECache!.fileExists(artifact.filePath)
        )
      );
      if (filesExist.every(Boolean)) recovered[key] = restored;
    }
    return recovered;
  }

  private validStoredGeneration(key: string, value: unknown): value is StoredGeneration {
    if (!value || typeof value !== 'object') return false;
    const generation = value as Partial<StoredGeneration>;
    return (
      typeof generation.manifestId === 'string' &&
      generation.manifestId === key &&
      typeof generation.remoteName === 'string' &&
      normalizeSha256(generation.generationId) !== null &&
      this.safeRelativePath(generation.rootPath) &&
      /^staging\/[a-f0-9]{64}\.\d+$/.test(generation.rootPath) &&
      Array.isArray(generation.artifacts) &&
      generation.artifacts.length > 0 &&
      generation.artifacts.every(
        (artifact) =>
          typeof artifact?.bundleUrl === 'string' &&
          normalizeSha256(artifact.bundleHash) !== null &&
          this.safeRelativePath(artifact.filePath) &&
          artifact.filePath.startsWith(`${generation.rootPath}/`) &&
          ['container', 'exposed', 'shared'].includes(artifact.kind) &&
          typeof artifact.downloadedAt === 'number' &&
          typeof artifact.lastUsedAt === 'number'
      )
    );
  }

  private safeRelativePath(value: unknown): value is string {
    return (
      typeof value === 'string' &&
      value.length > 0 &&
      value !== '.' &&
      !value.startsWith('/') &&
      !value.split('/').includes('..')
    );
  }

  private validRejectedGenerations(
    value: StoredCacheState['rejected'] | undefined
  ): CacheState['rejected'] {
    if (!value || typeof value !== 'object') return {};
    return Object.fromEntries(
      Object.entries(value).filter(
        ([, rejected]) =>
          normalizeSha256(rejected?.generationId) !== null &&
          typeof rejected.reason === 'string'
      )
    );
  }

  private relativePath(path: string): string {
    if (!path.startsWith(`${this.bundleDir}/`)) {
      throw new Error('Cache path escaped the configured cache directory');
    }
    return path.slice(this.bundleDir.length + 1);
  }

  private async removeGenerationFromState(
    group: 'active' | 'previous' | 'staged',
    manifestId: string
  ): Promise<void> {
    const generation = this.state[group][manifestId];
    if (!generation) return;
    const next = this.copyState();
    delete next[group][manifestId];
    await this.persistState(next);
    this.state = next;
    await this.deleteGeneration(generation);
  }

  private async deleteGeneration(generation: Generation): Promise<void> {
    await this.deletePath(generation.rootPath);
  }

  private async deletePath(path: string): Promise<void> {
    try {
      if (await NativeMFECache!.fileExists(path)) {
        await NativeMFECache!.deleteFile(path);
      }
    } catch {
      // Orphaned staging is inert and can be cleaned by a later cache clear.
    }
  }

  private manifestOutcome(
    status: ManifestOutcome['status'],
    generation: Generation,
    artifactStatus: ArtifactOutcome['status']
  ): ManifestOutcome {
    return {
      manifestId: generation.manifestId,
      remoteName: generation.remoteName,
      status,
      generationId: generation.generationId,
      artifacts: generation.artifacts.map((artifact) => ({
        manifestId: generation.manifestId,
        remoteName: generation.remoteName,
        bundleUrl: artifact.bundleUrl,
        status: artifactStatus,
        generationId: generation.generationId,
      })),
    };
  }

  private failedManifest(
    release: ManifestRelease,
    reason: NativeCacheFailureReason,
    artifacts: ArtifactOutcome[]
  ): ManifestOutcome {
    return {
      manifestId: release.manifestId,
      remoteName: release.remoteName,
      status: 'failed',
      reason,
      artifacts,
    };
  }

  private artifactOutcome(
    release: ManifestRelease,
    bundleUrl: string,
    status: ArtifactOutcome['status'],
    generationId?: string,
    reason?: NativeCacheFailureReason
  ): ArtifactOutcome {
    return {
      manifestId: release.manifestId,
      remoteName: release.remoteName,
      bundleUrl: getBundleCacheKey(bundleUrl),
      status,
      generationId,
      reason,
    };
  }

  private releaseFromGeneration(generation: Generation): ManifestRelease {
    return {
      manifestId: generation.manifestId,
      remoteName: generation.remoteName,
      artifacts: generation.artifacts.map((artifact) => ({
        bundleUrl: artifact.bundleUrl,
        expectedHash: artifact.bundleHash,
        kind: artifact.kind,
      })),
    };
  }

  private findManifestId(
    generations: Record<string, Generation>,
    remoteName: string
  ): string | undefined {
    return Object.values(generations).find(
      (generation) => generation.remoteName === remoteName
    )?.manifestId;
  }

  private sanitize(value: string): string {
    return value.replace(/[^a-z0-9._-]/gi, '_') || 'unknown';
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
