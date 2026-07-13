import type {
  TapCheckpoint,
  TapCommittedLifecycleListener,
  TapLifecycle,
  TapLifecycleContext,
  TapLifecycleError,
  TapLifecycleErrorKind,
  TapLifecycleErrorListener,
  TapLifecycleKind,
  TapLifecyclePlatformAdapter,
  TapLifecyclePluginOptions,
  TapLifecycleRequest,
  TapLifecycleResult,
  TapLifecycleScope,
  TapLifecycleStatus,
  TapLifecycleTransition,
  TapPreDecision,
  TapPreDecisionAggregation,
  TapPreDecisionRecord,
  TapPreDecisionPolicy,
  TapPreLifecycleListener,
  TapResolvedPreDecision,
} from './types';

type ActiveStatus = Exclude<TapLifecycleStatus, 'completed' | 'denied' | 'failed'>;

type ListenerOutcome<T> =
  | { type: 'value'; value: T }
  | { type: 'error'; error: unknown }
  | { type: 'terminal'; status: ActiveStatus };

type TransitionRuntime = {
  readonly kind: TapLifecycleKind;
  readonly scopeKey: string;
  readonly transition: TapLifecycleTransition;
  readonly controller: AbortController;
  readonly cleanup: () => void;
  timedOut: boolean;
  deadlineReported: boolean;
};

type MutableResult = {
  status: TapLifecycleStatus;
  transition: TapLifecycleTransition;
  checkpointReference?: string;
  decision: TapResolvedPreDecision;
  decisions: MutableDecisionRecord[];
  errors: TapLifecycleError[];
  denialReason?: string;
};

type MutableDecisionRecord = {
  phase: TapPreDecisionRecord['phase'];
  decision: TapPreDecision;
  honored: boolean;
};

const VALID_SCOPES = new Set<TapLifecycleScope>([
  'installation',
  'realm',
  'contribution',
  'mount',
]);

let systemSequence = 0;
let transitionSequence = 0;

function createSystemId(): string {
  const crypto = globalThis.crypto;
  if (typeof crypto?.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  systemSequence += 1;
  return `${Date.now().toString(36)}-${systemSequence.toString(36)}`;
}

function getAbortReason(signal: AbortSignal): unknown {
  return (signal as AbortSignal & { reason?: unknown }).reason;
}

function isPreDecision(value: unknown): value is TapPreDecision {
  return (
    !!value &&
    typeof value === 'object' &&
    'kind' in value &&
    (value.kind === 'continue' || value.kind === 'defer')
  );
}

function validateCheckpoint(value: unknown): TapCheckpoint | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Checkpoint callbacks must return an object or undefined.');
  }
  const checkpoint = value as TapCheckpoint;
  if (
    checkpoint.checkpointReference !== undefined &&
    (typeof checkpoint.checkpointReference !== 'string' ||
      !checkpoint.checkpointReference.trim())
  ) {
    throw new TypeError('checkpointReference must be a non-empty string.');
  }
  return checkpoint;
}

function validateAuthorization(value: unknown): asserts value is {
  allowed: boolean;
  reason?: string;
} {
  if (
    !value ||
    typeof value !== 'object' ||
    typeof (value as { allowed?: unknown }).allowed !== 'boolean'
  ) {
    throw new TypeError(
      'authorize must return an explicit { allowed: boolean } decision.'
    );
  }
  const reason = (value as { reason?: unknown }).reason;
  if (reason !== undefined && typeof reason !== 'string') {
    throw new TypeError('An authorization denial reason must be a string.');
  }
}

function normalizeDecision(value: unknown): TapPreDecision {
  if (value === undefined) {
    return { kind: 'continue' };
  }
  if (!isPreDecision(value)) {
    throw new TypeError(
      'Lifecycle pre-listeners must return { kind: "continue" }, { kind: "defer", delayMs }, or undefined.'
    );
  }
  if (value.kind === 'continue') {
    return value;
  }
  if (
    !Number.isSafeInteger(value.delayMs) ||
    value.delayMs < 0 ||
    (value.reason !== undefined && typeof value.reason !== 'string')
  ) {
    throw new TypeError(
      'Lifecycle defer decisions require a non-negative integer delayMs and an optional string reason.'
    );
  }
  return value;
}

function defaultDecision(
  aggregation: TapPreDecisionAggregation,
  honored = true
): TapResolvedPreDecision {
  return { aggregation, kind: 'continue', honored };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Host-only pause/resume coordinator. It deliberately does not model package state,
 * persistence, authorization, or revocation; those operations remain supplied by the TAP
 * platform adapter.
 */
export class TapLifecycleCoordinator implements TapLifecycle {
  private readonly platform: TapLifecyclePlatformAdapter;
  private readonly aggregation: TapPreDecisionAggregation;
  private readonly maxDelayMs: number;
  private readonly systemId = createSystemId();
  private readonly queues = new Map<string, Promise<void>>();
  private readonly epochs = new Map<string, number>();
  private readonly checkpointReferences = new Map<string, string | undefined>();
  private readonly prePauseListeners: TapPreLifecycleListener[] = [];
  private readonly pauseListeners: TapCommittedLifecycleListener[] = [];
  private readonly preResumeListeners: TapPreLifecycleListener[] = [];
  private readonly resumeListeners: TapCommittedLifecycleListener[] = [];
  private readonly errorListeners: TapLifecycleErrorListener[] = [];

  constructor(options: TapLifecyclePluginOptions) {
    if (!options?.platform) {
      throw new TypeError('zephyr-tap-runtime requires a platform adapter.');
    }
    this.platform = options.platform;
    const policy: TapPreDecisionPolicy = options.preDecision ?? {};
    this.aggregation = policy.aggregation ?? 'max-delay';
    this.maxDelayMs = policy.maxDelayMs ?? 0;
    if (this.aggregation !== 'max-delay' && this.aggregation !== 'all') {
      throw new TypeError('preDecision.aggregation must be "max-delay" or "all".');
    }
    if (!Number.isSafeInteger(this.maxDelayMs) || this.maxDelayMs < 0) {
      throw new TypeError('preDecision.maxDelayMs must be a non-negative integer.');
    }

    const hooks = options.hooks;
    if (hooks?.prePause) this.on('prePause', hooks.prePause);
    if (hooks?.pause) this.on('pause', hooks.pause);
    if (hooks?.preResume) this.on('preResume', hooks.preResume);
    if (hooks?.resume) this.on('resume', hooks.resume);
    if (hooks?.lifecycleError) this.on('lifecycleError', hooks.lifecycleError);
  }

  on(phase: 'prePause' | 'preResume', listener: TapPreLifecycleListener): () => void;
  on(phase: 'pause' | 'resume', listener: TapCommittedLifecycleListener): () => void;
  on(phase: 'lifecycleError', listener: TapLifecycleErrorListener): () => void;
  on(
    phase: 'prePause' | 'pause' | 'preResume' | 'resume' | 'lifecycleError',
    listener:
      | TapPreLifecycleListener
      | TapCommittedLifecycleListener
      | TapLifecycleErrorListener
  ): () => void {
    if (typeof listener !== 'function') {
      throw new TypeError(`A ${phase} lifecycle listener must be a function.`);
    }
    const listeners = this.listenersFor(phase);
    if (!listeners.includes(listener as never)) {
      listeners.push(listener as never);
    }
    return () => {
      const index = listeners.indexOf(listener as never);
      if (index >= 0) {
        listeners.splice(index, 1);
      }
    };
  }

  pause(request: TapLifecycleRequest): Promise<TapLifecycleResult> {
    return this.start('pause', request);
  }

  resume(request: TapLifecycleRequest): Promise<TapLifecycleResult> {
    return this.start('resume', request);
  }

  private start(
    kind: TapLifecycleKind,
    request: TapLifecycleRequest
  ): Promise<TapLifecycleResult> {
    try {
      const runtime = this.createRuntime(kind, request);
      return this.enqueue(runtime.scopeKey, () => this.execute(runtime));
    } catch (error) {
      return Promise.reject(error);
    }
  }

  private async execute(runtime: TransitionRuntime): Promise<TapLifecycleResult> {
    const result = this.createResult(runtime.transition);
    let checkpointReference = runtime.transition.checkpointReference;

    try {
      if (await this.finishIfTerminal(runtime, result)) {
        return result;
      }

      const authorization = await this.invoke(
        runtime,
        () => this.platform.authorize(this.contextFor(runtime, checkpointReference)),
        'authorize'
      );
      if (authorization.type === 'terminal') {
        await this.finishTerminal(runtime, result, authorization.status);
        return result;
      }
      if (authorization.type === 'error') {
        await this.failPlatform(runtime, result, 'authorize', authorization.error);
        return result;
      }
      try {
        validateAuthorization(authorization.value);
      } catch (error) {
        await this.failPlatform(runtime, result, 'authorize', error);
        return result;
      }
      if (!authorization.value.allowed) {
        result.status = 'denied';
        result.denialReason = authorization.value.reason;
        return result;
      }

      if (runtime.kind === 'resume' && checkpointReference === undefined) {
        checkpointReference = this.checkpointReferences.get(runtime.scopeKey);
      }

      const preStatus = await this.dispatchPre(runtime, result, checkpointReference);
      if (preStatus) {
        await this.finishTerminal(runtime, result, preStatus);
        return result;
      }

      const resolvedDecision = result.decision;
      if (resolvedDecision.kind === 'defer' && resolvedDecision.delayMs) {
        const deferred = await this.invoke(
          runtime,
          () => delay(resolvedDecision.delayMs),
          'prePause'
        );
        if (deferred.type === 'terminal') {
          await this.finishTerminal(runtime, result, deferred.status);
          return result;
        }
        if (deferred.type === 'error') {
          await this.failPlatform(runtime, result, 'prePause', deferred.error);
          return result;
        }
      }

      if (await this.finishIfTerminal(runtime, result)) {
        return result;
      }

      if (runtime.kind === 'pause') {
        const checkpointOutcome = await this.invoke(
          runtime,
          () =>
            this.platform.createCheckpoint(this.contextFor(runtime, checkpointReference)),
          'checkpoint'
        );
        if (checkpointOutcome.type === 'terminal') {
          await this.finishTerminal(runtime, result, checkpointOutcome.status);
          return result;
        }
        if (checkpointOutcome.type === 'error') {
          await this.failPlatform(runtime, result, 'checkpoint', checkpointOutcome.error);
          return result;
        }

        let checkpoint: TapCheckpoint | undefined;
        try {
          checkpoint = validateCheckpoint(checkpointOutcome.value);
        } catch (error) {
          await this.failPlatform(runtime, result, 'checkpoint', error);
          return result;
        }
        checkpointReference = checkpoint?.checkpointReference ?? checkpointReference;
        const persisted = await this.invoke(
          runtime,
          () =>
            this.platform.persistPaused(
              this.contextFor(runtime, checkpointReference, checkpoint)
            ),
          'persistPaused'
        );
        if (persisted.type === 'terminal') {
          await this.finishTerminal(runtime, result, persisted.status);
          return result;
        }
        if (persisted.type === 'error') {
          await this.failPlatform(runtime, result, 'persistPaused', persisted.error);
          return result;
        }
        this.checkpointReferences.set(runtime.scopeKey, checkpointReference);
        result.checkpointReference = checkpointReference;
        await this.dispatchCommitted(
          runtime,
          result,
          'pause',
          this.contextFor(runtime, checkpointReference, checkpoint)
        );
      } else {
        const restored = await this.invoke(
          runtime,
          () =>
            this.platform.loadCheckpoint(this.contextFor(runtime, checkpointReference)),
          'restoreCheckpoint'
        );
        if (restored.type === 'terminal') {
          await this.finishTerminal(runtime, result, restored.status);
          return result;
        }
        if (restored.type === 'error') {
          await this.failPlatform(runtime, result, 'restoreCheckpoint', restored.error);
          return result;
        }

        let checkpoint: TapCheckpoint | undefined;
        try {
          checkpoint = validateCheckpoint(restored.value);
        } catch (error) {
          await this.failPlatform(runtime, result, 'restoreCheckpoint', error);
          return result;
        }
        checkpointReference = checkpoint?.checkpointReference ?? checkpointReference;
        const persisted = await this.invoke(
          runtime,
          () =>
            this.platform.persistResumed(
              this.contextFor(runtime, checkpointReference, checkpoint)
            ),
          'persistResumed'
        );
        if (persisted.type === 'terminal') {
          await this.finishTerminal(runtime, result, persisted.status);
          return result;
        }
        if (persisted.type === 'error') {
          await this.failPlatform(runtime, result, 'persistResumed', persisted.error);
          return result;
        }
        // Resume must not lose a reference merely because loadCheckpoint only
        // returns a value; the committed event/result retains the prior one.
        result.checkpointReference = checkpointReference;
        await this.dispatchCommitted(
          runtime,
          result,
          'resume',
          this.contextFor(runtime, checkpointReference, checkpoint)
        );
      }

      await this.finishIfTerminal(runtime, result);
      return result;
    } finally {
      runtime.cleanup();
    }
  }

  private async dispatchPre(
    runtime: TransitionRuntime,
    result: MutableResult,
    checkpointReference: string | undefined
  ): Promise<ActiveStatus | undefined> {
    const phase = runtime.kind === 'pause' ? 'prePause' : 'preResume';
    const listeners =
      runtime.kind === 'pause' ? this.prePauseListeners : this.preResumeListeners;
    const context = this.contextFor(runtime, checkpointReference);

    for (const listener of listeners.slice()) {
      const outcome = await this.invoke(runtime, () => listener(context), phase);
      if (outcome.type === 'terminal') {
        return outcome.status;
      }
      if (outcome.type === 'error') {
        await this.recordError(result, runtime, phase, 'callback', outcome.error);
        result.decisions.push({ phase, decision: { kind: 'continue' }, honored: true });
        continue;
      }
      try {
        result.decisions.push({
          phase,
          decision: normalizeDecision(outcome.value),
          honored: true,
        });
      } catch (error) {
        await this.recordError(result, runtime, phase, 'invalid-decision', error);
        result.decisions.push({ phase, decision: { kind: 'continue' }, honored: true });
      }
    }

    result.decision = this.resolveDecision(runtime, result.decisions);
    return undefined;
  }

  private async dispatchCommitted(
    runtime: TransitionRuntime,
    result: MutableResult,
    phase: 'pause' | 'resume',
    context: TapLifecycleContext
  ): Promise<void> {
    const listeners = phase === 'pause' ? this.pauseListeners : this.resumeListeners;
    for (const listener of listeners.slice()) {
      const outcome = await this.invoke(runtime, () => listener(context), phase);
      if (outcome.type === 'terminal') {
        await this.finishTerminal(runtime, result, outcome.status);
        return;
      }
      if (outcome.type === 'error') {
        await this.recordError(result, runtime, phase, 'callback', outcome.error);
      }
    }
  }

  private resolveDecision(
    runtime: TransitionRuntime,
    records: MutableDecisionRecord[]
  ): TapResolvedPreDecision {
    const deferrals = records.filter((record) => record.decision.kind === 'defer');
    if (!deferrals.length) {
      return defaultDecision(this.aggregation);
    }
    if (runtime.transition.force) {
      for (const record of deferrals) record.honored = false;
      return defaultDecision(this.aggregation, false);
    }
    if (this.aggregation === 'all' && deferrals.length !== records.length) {
      for (const record of deferrals) record.honored = false;
      return defaultDecision(this.aggregation, false);
    }
    const requested = Math.max(
      ...deferrals.map((record) =>
        record.decision.kind === 'defer' ? record.decision.delayMs : 0
      )
    );
    const bounded = Math.min(
      requested,
      this.maxDelayMs,
      Math.max(0, runtime.transition.deadline - Date.now())
    );
    for (const record of deferrals) {
      record.honored =
        record.decision.kind === 'defer' &&
        bounded > 0 &&
        record.decision.delayMs <= bounded;
    }
    if (!bounded) {
      return defaultDecision(this.aggregation, false);
    }
    return {
      aggregation: this.aggregation,
      kind: 'defer',
      delayMs: bounded,
      honored: bounded === requested,
    };
  }

  private async failPlatform(
    runtime: TransitionRuntime,
    result: MutableResult,
    phase: Exclude<TapLifecycleError['phase'], 'lifecycleError'>,
    error: unknown
  ): Promise<void> {
    result.status = 'failed';
    await this.recordError(result, runtime, phase, 'platform', error);
  }

  private async finishIfTerminal(
    runtime: TransitionRuntime,
    result: MutableResult
  ): Promise<boolean> {
    const status = this.statusOf(runtime);
    if (!status) return false;
    await this.finishTerminal(runtime, result, status);
    return true;
  }

  private async finishTerminal(
    runtime: TransitionRuntime,
    result: MutableResult,
    status: ActiveStatus
  ): Promise<void> {
    if (result.status !== 'completed') return;
    result.status = status;
    result.decision = defaultDecision(this.aggregation, false);
    if (status !== 'timed_out' || runtime.deadlineReported) return;

    runtime.deadlineReported = true;
    await this.recordError(
      result,
      runtime,
      'lifecycleError',
      'deadline',
      new Error(
        `TAP ${runtime.kind} transition "${runtime.transition.transitionId}" exceeded its deadline.`
      )
    );
  }

  private async recordError(
    result: MutableResult | undefined,
    runtime: TransitionRuntime,
    phase: TapLifecycleError['phase'],
    kind: TapLifecycleErrorKind,
    error: unknown
  ): Promise<void> {
    const event: TapLifecycleError = {
      phase,
      transition: runtime.transition,
      kind,
      error,
    };
    result?.errors.push(event);

    for (const listener of this.errorListeners.slice()) {
      const outcome = await this.invoke(
        runtime,
        () => listener(event),
        'lifecycleError',
        true
      );
      if (outcome.type === 'error') {
        result?.errors.push({
          phase: 'lifecycleError',
          transition: runtime.transition,
          kind: 'callback',
          error: outcome.error,
        });
      }
    }
  }

  private async invoke<T>(
    runtime: TransitionRuntime,
    callback: () => T | Promise<T>,
    phase: Exclude<TapLifecycleError['phase'], 'lifecycleError'> | 'lifecycleError',
    allowTerminalStart = false
  ): Promise<ListenerOutcome<T>> {
    const initial = this.statusOf(runtime);
    if (initial && !allowTerminalStart) {
      return { type: 'terminal', status: initial };
    }

    let pending: Promise<Exclude<ListenerOutcome<T>, { type: 'terminal' }>>;
    try {
      pending = Promise.resolve(callback()).then(
        (value) => ({ type: 'value', value }) as const,
        (error) => ({ type: 'error', error }) as const
      );
    } catch (error) {
      pending = Promise.resolve({ type: 'error', error });
    }

    const afterStart = this.statusOf(runtime);
    if (afterStart) {
      this.observeLateFailure(runtime, pending, phase);
      return { type: 'terminal', status: afterStart };
    }

    const terminal = this.waitForTerminal(runtime);
    const outcome = await Promise.race([pending, terminal.promise]);
    terminal.cleanup();
    if (outcome.type === 'terminal') {
      this.observeLateFailure(runtime, pending, phase);
    }
    return outcome;
  }

  private observeLateFailure<T>(
    runtime: TransitionRuntime,
    pending: Promise<Exclude<ListenerOutcome<T>, { type: 'terminal' }>>,
    phase: TapLifecycleError['phase']
  ): void {
    void pending.then((outcome) => {
      if (outcome.type === 'error' && phase !== 'lifecycleError') {
        void this.recordError(undefined, runtime, phase, 'callback', outcome.error);
      }
    });
  }

  private waitForTerminal(runtime: TransitionRuntime): {
    promise: Promise<{ type: 'terminal'; status: ActiveStatus }>;
    cleanup: () => void;
  } {
    let resolved = false;
    let resolveTerminal!: (outcome: { type: 'terminal'; status: ActiveStatus }) => void;
    const promise = new Promise<{ type: 'terminal'; status: ActiveStatus }>((resolve) => {
      resolveTerminal = resolve;
    });
    const onAbort = () => {
      const status = this.statusOf(runtime);
      if (!status || resolved) return;
      resolved = true;
      resolveTerminal({ type: 'terminal', status });
    };
    runtime.transition.signal.addEventListener('abort', onAbort, { once: true });
    onAbort();
    return {
      promise,
      cleanup: () => runtime.transition.signal.removeEventListener('abort', onAbort),
    };
  }

  private statusOf(runtime: TransitionRuntime): ActiveStatus | undefined {
    if (!runtime.timedOut && Date.now() >= runtime.transition.deadline) {
      runtime.timedOut = true;
      runtime.controller.abort(
        new Error(
          `TAP ${runtime.kind} transition "${runtime.transition.transitionId}" exceeded its deadline.`
        )
      );
    }
    if (runtime.timedOut) return 'timed_out';
    return runtime.transition.signal.aborted ? 'cancelled' : undefined;
  }

  private contextFor(
    runtime: TransitionRuntime,
    checkpointReference: string | undefined,
    checkpoint?: TapCheckpoint
  ): TapLifecycleContext {
    return {
      kind: runtime.kind,
      transition: runtime.transition,
      checkpointReference,
      checkpoint,
    };
  }

  private createRuntime(
    kind: TapLifecycleKind,
    request: TapLifecycleRequest
  ): TransitionRuntime {
    this.validateRequest(request);
    const scopeKey = `${request.scope}\u0000${request.scopeId}`;
    const previousEpoch = this.epochs.get(scopeKey);
    const lifecycleEpoch = request.lifecycleEpoch ?? (previousEpoch ?? -1) + 1;
    if (previousEpoch !== undefined && lifecycleEpoch <= previousEpoch) {
      throw new RangeError(
        `lifecycleEpoch for ${request.scope}:${request.scopeId} must be greater than ${previousEpoch}.`
      );
    }
    this.epochs.set(scopeKey, lifecycleEpoch);

    const controller = new AbortController();
    const requestedAt = Date.now();
    transitionSequence += 1;
    const transition = Object.freeze({
      scope: request.scope,
      scopeId: request.scopeId,
      reason: request.reason,
      force: request.force,
      deadline: request.deadline,
      checkpointReference: request.checkpointReference,
      context: request.context,
      transitionId: `tap:${this.systemId}:${transitionSequence.toString(36)}`,
      lifecycleEpoch,
      requestedAt,
      signal: controller.signal,
    }) as TapLifecycleTransition;

    let cleanedUp = false;
    const onExternalAbort = () => controller.abort(getAbortReason(request.signal!));
    if (request.signal?.aborted) {
      onExternalAbort();
    } else {
      request.signal?.addEventListener('abort', onExternalAbort, { once: true });
    }
    let runtime!: TransitionRuntime;
    const timeout = setTimeout(
      () => {
        runtime.timedOut = true;
        controller.abort(
          new Error(
            `TAP ${kind} transition "${transition.transitionId}" exceeded its deadline.`
          )
        );
      },
      Math.max(0, request.deadline - requestedAt)
    );

    runtime = {
      kind,
      scopeKey,
      transition,
      controller,
      timedOut: false,
      deadlineReported: false,
      cleanup: () => {
        if (cleanedUp) return;
        cleanedUp = true;
        clearTimeout(timeout);
        request.signal?.removeEventListener('abort', onExternalAbort);
      },
    };
    return runtime;
  }

  private validateRequest(request: TapLifecycleRequest): void {
    if (!VALID_SCOPES.has(request.scope)) {
      throw new TypeError('A valid TAP lifecycle scope is required.');
    }
    if (typeof request.scopeId !== 'string' || !request.scopeId.trim()) {
      throw new TypeError('scopeId must be a non-empty string.');
    }
    if (typeof request.reason !== 'string' || !request.reason.trim()) {
      throw new TypeError('reason must be a non-empty string.');
    }
    if (typeof request.force !== 'boolean') {
      throw new TypeError('force must be a boolean.');
    }
    if (!Number.isFinite(request.deadline)) {
      throw new TypeError('deadline must be a finite absolute timestamp.');
    }
    if (
      request.lifecycleEpoch !== undefined &&
      (!Number.isSafeInteger(request.lifecycleEpoch) || request.lifecycleEpoch < 0)
    ) {
      throw new TypeError('lifecycleEpoch must be a non-negative integer.');
    }
    if (
      request.checkpointReference !== undefined &&
      (typeof request.checkpointReference !== 'string' ||
        !request.checkpointReference.trim())
    ) {
      throw new TypeError('checkpointReference must be a non-empty string.');
    }
  }

  private createResult(transition: TapLifecycleTransition): MutableResult {
    return {
      status: 'completed',
      transition,
      decision: defaultDecision(this.aggregation),
      decisions: [],
      errors: [],
    };
  }

  private enqueue<T>(scopeKey: string, task: () => Promise<T>): Promise<T> {
    const previous = this.queues.get(scopeKey) ?? Promise.resolve();
    const queued = previous.catch(() => undefined).then(task);
    const tail = queued.then(
      () => undefined,
      () => undefined
    );
    this.queues.set(scopeKey, tail);
    void tail.then(() => {
      if (this.queues.get(scopeKey) === tail) this.queues.delete(scopeKey);
    });
    return queued;
  }

  private listenersFor(
    phase: 'prePause' | 'pause' | 'preResume' | 'resume' | 'lifecycleError'
  ): Array<
    TapPreLifecycleListener | TapCommittedLifecycleListener | TapLifecycleErrorListener
  > {
    switch (phase) {
      case 'prePause':
        return this.prePauseListeners;
      case 'pause':
        return this.pauseListeners;
      case 'preResume':
        return this.preResumeListeners;
      case 'resume':
        return this.resumeListeners;
      case 'lifecycleError':
        return this.errorListeners;
    }
  }
}
