/**
 * Host-owned scopes. A scope is part of the lock key, so pausing one mounted contribution
 * cannot block an unrelated realm or mount.
 */
export type TapLifecycleScope = 'installation' | 'realm' | 'contribution' | 'mount';

export type TapLifecycleKind = 'pause' | 'resume';

export type TapLifecyclePhase =
  | 'authorize'
  | 'prePause'
  | 'checkpoint'
  | 'persistPaused'
  | 'preResume'
  | 'restoreCheckpoint'
  | 'persistResumed'
  | 'pause'
  | 'resume'
  | 'lifecycleError';

export type TapLifecycleStatus =
  | 'completed'
  | 'cancelled'
  | 'timed_out'
  | 'denied'
  | 'failed';

/**
 * An absolute-deadline transition request issued by the trusted host. Package code never
 * supplies IDs, timestamps, or a mutable cancellation signal.
 */
export interface TapLifecycleRequest {
  scope: TapLifecycleScope;
  scopeId: string;
  reason: string;
  force: boolean;
  /** Absolute Unix time in milliseconds. */
  deadline: number;
  /** Optional host cancellation composed with the transition deadline. */
  signal?: AbortSignal;
  /** A host-restored epoch must strictly increase inside its scope. */
  lifecycleEpoch?: number;
  /** An explicit checkpoint takes precedence over the last committed pause. */
  checkpointReference?: string;
  context?: Readonly<Record<string, unknown>>;
}

export interface TapLifecycleTransition extends Omit<
  TapLifecycleRequest,
  'lifecycleEpoch' | 'signal'
> {
  readonly transitionId: string;
  readonly lifecycleEpoch: number;
  readonly requestedAt: number;
  readonly signal: AbortSignal;
}

export type TapPreDecision =
  | { kind: 'continue' }
  | { kind: 'defer'; delayMs: number; reason?: string };

export type TapPreDecisionAggregation = 'max-delay' | 'all';

/**
 * `all` only delays when every listener asks to defer. In that case the longest requested
 * delay is used, subject to the same host cap/deadline as `max-delay`.
 */
export interface TapPreDecisionPolicy {
  aggregation?: TapPreDecisionAggregation;
  /** Voluntary deferral cap, in milliseconds. Defaults to zero. */
  maxDelayMs?: number;
}

export interface TapCheckpoint {
  checkpointReference?: string;
  value?: unknown;
}

export interface TapLifecycleContext {
  readonly kind: TapLifecycleKind;
  readonly transition: TapLifecycleTransition;
  readonly checkpointReference?: string;
  readonly checkpoint?: TapCheckpoint;
}

export interface TapLifecycleAuthorizationContext extends Omit<
  TapLifecycleContext,
  'checkpoint'
> {}

export type TapLifecycleAuthorizationResult =
  | { allowed: true }
  | { allowed: false; reason?: string };

/**
 * The platform remains the authority for authorization and durable state. The runtime
 * package only orders these callbacks and publishes observations.
 */
export interface TapLifecyclePlatformAdapter {
  authorize(
    context: TapLifecycleAuthorizationContext
  ): TapLifecycleAuthorizationResult | Promise<TapLifecycleAuthorizationResult>;
  createCheckpoint(
    context: TapLifecycleContext
  ): TapCheckpoint | undefined | Promise<TapCheckpoint | undefined>;
  persistPaused(context: TapLifecycleContext): void | Promise<void>;
  loadCheckpoint(
    context: TapLifecycleContext
  ): TapCheckpoint | undefined | Promise<TapCheckpoint | undefined>;
  persistResumed(context: TapLifecycleContext): void | Promise<void>;
}

export type TapPreLifecycleListener = (
  context: TapLifecycleContext
) => TapPreDecision | undefined | Promise<TapPreDecision | undefined>;

export type TapCommittedLifecycleListener = (
  context: TapLifecycleContext
) => void | Promise<void>;

export type TapLifecycleErrorKind =
  | 'callback'
  | 'invalid-decision'
  | 'platform'
  | 'deadline';

export interface TapLifecycleError {
  readonly phase: TapLifecyclePhase;
  readonly transition: TapLifecycleTransition;
  readonly kind: TapLifecycleErrorKind;
  readonly error: unknown;
}

export type TapLifecycleErrorListener = (
  event: TapLifecycleError
) => void | Promise<void>;

export interface TapLifecycleHooks {
  prePause?: TapPreLifecycleListener;
  pause?: TapCommittedLifecycleListener;
  preResume?: TapPreLifecycleListener;
  resume?: TapCommittedLifecycleListener;
  lifecycleError?: TapLifecycleErrorListener;
}

export interface TapPreDecisionRecord {
  readonly phase: 'prePause' | 'preResume';
  readonly decision: TapPreDecision;
  readonly honored: boolean;
}

export type TapResolvedPreDecision =
  | {
      readonly aggregation: TapPreDecisionAggregation;
      readonly kind: 'continue';
      readonly honored: boolean;
    }
  | {
      readonly aggregation: TapPreDecisionAggregation;
      readonly kind: 'defer';
      readonly honored: boolean;
      readonly delayMs: number;
    };

export interface TapLifecycleResult {
  readonly status: TapLifecycleStatus;
  readonly transition: TapLifecycleTransition;
  /** Retained for a successful resume even when the loader returns no new ref. */
  readonly checkpointReference?: string;
  readonly decision: TapResolvedPreDecision;
  readonly decisions: ReadonlyArray<TapPreDecisionRecord>;
  readonly errors: ReadonlyArray<TapLifecycleError>;
  readonly denialReason?: string;
}

export interface TapLifecyclePluginOptions {
  platform: TapLifecyclePlatformAdapter;
  hooks?: TapLifecycleHooks;
  preDecision?: TapPreDecisionPolicy;
}

export interface TapLifecycle {
  pause(request: TapLifecycleRequest): Promise<TapLifecycleResult>;
  resume(request: TapLifecycleRequest): Promise<TapLifecycleResult>;
  on(phase: 'prePause' | 'preResume', listener: TapPreLifecycleListener): () => void;
  on(phase: 'pause' | 'resume', listener: TapCommittedLifecycleListener): () => void;
  on(phase: 'lifecycleError', listener: TapLifecycleErrorListener): () => void;
}
