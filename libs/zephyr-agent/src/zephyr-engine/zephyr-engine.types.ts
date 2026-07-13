import type { ZeBuildAssetsMap, ZephyrBuildTarget } from 'zephyr-edge-contract';

export type ZephyrEngineBuilderTypes =
  | 'webpack'
  | 'rspack'
  | 'repack'
  | 'metro'
  | 'vite'
  | 'nuxt'
  | 'rollup'
  | 'rolldown'
  | 'parcel'
  | 'astro'
  | 'unknown';

export interface ZephyrEngineOptions {
  context: string | undefined;
  builder: ZephyrEngineBuilderTypes;
  /** Build target supplied by a public adapter before dependency resolution starts. */
  target?: ZephyrBuildTarget;
}

/** Adapter-defined role, commonly client, server, csr, ssr, rsc, or worker. */
export type BuildParticipantRole = string;

export interface BuildParticipant {
  /** Stable name used when contributing and completing this participant. */
  name: string;
  /** Describes the participant without affecting its identity. */
  role?: BuildParticipantRole;
  /** Required participants block publication until completed. Defaults to true. */
  required?: boolean;
}

export interface BuildSessionIdentity {
  applicationUid: string;
  invocationId: string;
  generation: number;
}

export type BuildSessionStatus =
  | 'collecting'
  | 'sealed'
  | 'publishing'
  | 'published'
  | 'failed'
  | 'aborted';

export interface BeginBuildOptions {
  /** Stable identity shared by all compilers participating in one logical build. */
  invocationId?: string;
  /** Monotonically increasing watch-build generation. Auto-increments when omitted. */
  generation?: number;
  participants: readonly BuildParticipant[];
  /** Named framework/bundler work which must finish after compiler output is collected. */
  postprocessors?: readonly string[];
  /**
   * Reject aliases such as backslashes, duplicate separators, and `./` rather than
   * normalizing/re-hashing them. Use for descriptor-locked artifact packages.
   */
  strictAssetPaths?: boolean;
}

export interface BuildContribution<TData = unknown> {
  participant: string;
  /**
   * Stable output key within a participant. Re-contributing the same key replaces the
   * earlier output before the session is sealed.
   */
  key: string;
  assetsMap: ZeBuildAssetsMap;
  data?: TData;
}

export interface PublishedBuildContribution<
  TData = unknown,
> extends BuildContribution<TData> {
  role?: BuildParticipantRole;
}

export interface BuildSessionPublication<TData = unknown> {
  identity: BuildSessionIdentity;
  assetsMap: ZeBuildAssetsMap;
  contributions: readonly PublishedBuildContribution<TData>[];
}

export interface BuildSessionReadiness {
  ready: boolean;
  pendingParticipants: readonly string[];
  pendingPostprocessors: readonly string[];
}

export type BuildSessionLifecycleCallback<TResult, TData = unknown> = (
  publication: BuildSessionPublication<TData>,
  result: TResult
) => void | Promise<void>;

/**
 * Synchronous rollback invoked exactly once when a logical build becomes terminally
 * failed or aborted. Rollback is synchronous so a superseding generation cannot start
 * against state owned by the failed generation.
 */
export type BuildSessionFailureCallback = (
  identity: BuildSessionIdentity,
  error: Error
) => void;

export interface ApplicationContextOptions<TData = unknown, TResult = void> {
  applicationUid: string;
  /** Called once after validation and immediately before the publication is uploaded. */
  prepare?: (identity: BuildSessionIdentity) => void | Promise<void>;
  /** Called exactly once for a successfully prepared logical build. */
  publish: (publication: BuildSessionPublication<TData>) => TResult | Promise<TResult>;
  /** Called once after a successful publication. */
  finish?: BuildSessionLifecycleCallback<TResult, TData>;
  /** Called once to discard state owned by a failed or aborted generation. */
  onFailure?: BuildSessionFailureCallback;
}

export interface ApplicationContextRegistryLocator {
  /** Known after application initialization. */
  applicationUid?: string;
  /** Stable logical-build identity. Required with applicationUid for an identity key. */
  invocationId?: string;
  /** Early key supplied by a wrapper before application/invocation identity is known. */
  contextKey?: string;
}
