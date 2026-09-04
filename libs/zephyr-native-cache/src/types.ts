export type BundleStatus = 'active' | 'pendingUpdate' | 'broken' | 'pendingCleanup';

export type BundleLoadStatus = 'cache-hit' | 'downloaded' | 'skipped' | 'pending';

export type UpdatePolicy = 'downloadOnly' | 'downloadAndApply';

export type ManifestArtifactKind = 'container' | 'exposed' | 'shared';

export type NativeCacheFailureReason =
  | 'native-unavailable'
  | 'missing-hash'
  | 'malformed-hash'
  | 'timeout'
  | 'network-failure'
  | 'http-failure'
  | 'hash-mismatch'
  | 'corrupt-cache'
  | 'storage-failure'
  | 'evaluation-failure'
  | 'activation-failure'
  | 'rollback-failure'
  | 'runtime-poisoned';

export interface ManifestArtifact {
  bundleUrl: string;
  expectedHash: string | undefined;
  kind: ManifestArtifactKind;
}

export interface ManifestRelease {
  manifestId: string;
  remoteName: string;
  artifacts: ManifestArtifact[];
}

export interface ArtifactOutcome {
  manifestId: string;
  remoteName: string;
  bundleUrl: string;
  status: 'cache-hit' | 'staged' | 'activated' | 'rolled-back' | 'failed';
  generationId?: string;
  reason?: NativeCacheFailureReason;
}

export interface ManifestOutcome {
  manifestId: string;
  remoteName: string;
  status: 'unchanged' | 'staged' | 'activated' | 'rolled-back' | 'failed';
  generationId?: string;
  reason?: NativeCacheFailureReason;
  artifacts: ArtifactOutcome[];
}

export interface BundleLoadResult {
  status: 'cache-hit' | 'downloaded';
  outcome: ArtifactOutcome;
  candidateOutcome?: ArtifactOutcome;
}

export interface BundleMetadata {
  remoteName: string;
  bundleHash: string;
  buildVersion: string;
  filePath: string;
  bundleUrl: string;
  downloadedAt: number;
  lastUsedAt: number;
  status: BundleStatus;
  retryCount: number;
  lastRetryAt: number | null;
}

export interface CachedBundleResult {
  source: 'memory' | 'disk';
  filePath: string;
  metadata: BundleMetadata;
}

/** Unified configuration for the MFE cache layer. */
export interface MFECacheConfig {
  /** Custom bundle storage directory */
  bundleDir?: string;
  /** Max total cache size in bytes before eviction (default: 20MB) */
  maxCacheSizeBytes?: number;
  /** Max age in milliseconds before a bundle is considered stale (default: 7 days) */
  maxAgeMs?: number;
  /** Minimum cache size in bytes to keep even if all bundles are stale (default: 0) */
  minCacheSizeBytes?: number;
  /** Whether to enable automatic polling for manifest updates (default: true) */
  enablePolling?: boolean;
  /** Polling interval in milliseconds (default: 5 minutes) */
  pollIntervalMs?: number;
  /** Force enable cache in dev mode (default: false). Production always enables cache. */
  forceCacheInDev?: boolean;
  /**
   * Optional side-effect-free validation performed before a staged generation is
   * activated.
   */
  validateBundle?: (bundleUrl: string, source: string) => void | Promise<void>;
}

export interface CacheStatusRemoteEntry {
  remoteName: string;
  bundleUrl: string;
  status: BundleLoadStatus;
  hash: string | undefined;
  loadedAt: number | undefined;
}

export interface CachePollResult {
  checked: number;
  updated: number;
}

export interface CacheStatusSnapshot {
  remotes: Record<string, CacheStatusRemoteEntry>;
  pollingEnabled: boolean;
  pollIntervalMs: number;
  isPolling: boolean;
  lastPollAt: number | undefined;
  lastPollResult: CachePollResult | undefined;
  pendingUpdates: string[];
}

export interface CheckForUpdatesOptions {
  policy?: UpdatePolicy;
}

export interface CheckForUpdatesResult {
  updated: number;
  checked: number;
  applied: boolean;
  outcomes: ManifestOutcome[];
}

export type CacheStatusListener = (status: CacheStatusSnapshot) => void;
