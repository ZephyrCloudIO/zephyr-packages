import type { ZeBuildAsset, ZeBuildAssetsMap } from 'zephyr-edge-contract';
import { zeBuildAssets } from '../lib/transformers/ze-build-assets';
import type {
  BuildContribution,
  BuildParticipant,
  BuildSessionFailureCallback,
  BuildSessionIdentity,
  BuildSessionPublication,
  BuildSessionReadiness,
  BuildSessionStatus,
  PublishedBuildContribution,
} from './zephyr-engine.types';

export class BuildSessionStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BuildSessionStateError';
  }
}

export class BuildSessionNotReadyError extends BuildSessionStateError {
  readonly readiness: BuildSessionReadiness;

  constructor(readiness: BuildSessionReadiness) {
    const pending = [
      ...readiness.pendingParticipants.map((name) => `participant:${name}`),
      ...readiness.pendingPostprocessors.map((name) => `postprocessor:${name}`),
    ];
    super(`Build session is not ready; waiting for ${pending.join(', ')}`);
    this.name = 'BuildSessionNotReadyError';
    this.readiness = readiness;
  }
}

export class BuildSessionAssetCollisionError extends Error {
  readonly path: string;
  readonly existingHash: string;
  readonly incomingHash: string;

  constructor(path: string, existingHash: string, incomingHash: string) {
    super(
      `Conflicting assets were contributed for "${path}": ` +
        `${existingHash} and ${incomingHash}`
    );
    this.name = 'BuildSessionAssetCollisionError';
    this.path = path;
    this.existingHash = existingHash;
    this.incomingHash = incomingHash;
  }
}

export class BuildSessionAbortedError extends Error {
  readonly reason: unknown;

  constructor(reason?: unknown) {
    const detail = reason instanceof Error ? reason.message : String(reason ?? 'aborted');
    super(`Build session was aborted: ${detail}`);
    this.name = 'BuildSessionAbortedError';
    this.reason = reason;
  }
}

export class BuildParticipantFailedError extends Error {
  readonly participant: string;
  readonly cause: unknown;

  constructor(participant: string, cause: unknown) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    super(`Build participant "${participant}" failed: ${detail}`);
    this.name = 'BuildParticipantFailedError';
    this.participant = participant;
    this.cause = cause;
  }
}

export class BuildSessionRollbackError extends Error {
  readonly buildError: Error;
  readonly rollbackError: Error;

  constructor(buildError: Error, rollbackError: Error) {
    super(`Build session failed and its rollback also failed: ${rollbackError.message}`);
    this.name = 'BuildSessionRollbackError';
    this.buildError = buildError;
    this.rollbackError = rollbackError;
  }
}

interface BuildSessionCallbacks<TData, TResult> {
  prepare?: (identity: BuildSessionIdentity) => void | Promise<void>;
  publish: (publication: BuildSessionPublication<TData>) => TResult | Promise<TResult>;
  finish?: (
    publication: BuildSessionPublication<TData>,
    result: TResult
  ) => void | Promise<void>;
  onFailure?: BuildSessionFailureCallback;
}

interface DeferredBarrier {
  promise: Promise<void>;
  resolve: () => void;
  reject: (reason: unknown) => void;
}

function createBarrier(): DeferredBarrier {
  let resolve!: () => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  // A participant may fail before publish() starts awaiting the barrier. Keep that
  // legitimate lifecycle transition from becoming an unhandled rejection.
  void promise.catch(() => undefined);
  return { promise, resolve, reject };
}

function assertNonEmpty(value: string, description: string): void {
  if (!value.trim()) {
    throw new BuildSessionStateError(`${description} must not be empty`);
  }
}

function sameAsset(existing: ZeBuildAsset, incoming: ZeBuildAsset): boolean {
  return (
    normalizeAssetPath(existing.path) === normalizeAssetPath(incoming.path) &&
    existing.hash === incoming.hash &&
    existing.size === incoming.size
  );
}

function normalizeAssetPath(assetPath: string): string {
  const normalized = assetPath.replace(/\\/g, '/');
  if (
    !normalized ||
    normalized.includes('\0') ||
    normalized.startsWith('/') ||
    /^[A-Za-z]:/.test(normalized)
  ) {
    throw new BuildSessionStateError(
      `Asset path must be a relative snapshot path: "${assetPath}"`
    );
  }

  const segments = normalized.split('/').filter((segment) => segment && segment !== '.');
  if (segments.length === 0 || segments.includes('..')) {
    throw new BuildSessionStateError(
      `Asset path must not escape the snapshot root: "${assetPath}"`
    );
  }
  return segments.join('/');
}

function cloneAssetsMap(assetsMap: ZeBuildAssetsMap): ZeBuildAssetsMap {
  return Object.fromEntries(
    Object.values(assetsMap).map((value) => {
      const normalizedPath = normalizeAssetPath(value.path);
      const normalizedAsset =
        normalizedPath === value.path
          ? { ...value }
          : zeBuildAssets({ filepath: normalizedPath, content: value.buffer });
      return [normalizedAsset.hash, Object.freeze(normalizedAsset)];
    })
  );
}

/**
 * Coordinates every compiler involved in one logical application build. A session is
 * deliberately independent from bundler APIs: adapters contribute keyed asset maps,
 * complete their barriers, and share one idempotent publish operation.
 */
export class BuildSession<TData = unknown, TResult = void> {
  readonly identity: BuildSessionIdentity;

  private readonly participants = new Map<string, Required<BuildParticipant>>();
  private readonly postprocessors = new Set<string>();
  private readonly completedParticipants = new Set<string>();
  private readonly completedPostprocessors = new Set<string>();
  private readonly contributions = new Map<
    string,
    Map<string, BuildContribution<TData>>
  >();
  private readonly callbacks: BuildSessionCallbacks<TData, TResult>;
  private readonly barrier = createBarrier();
  private state: BuildSessionStatus = 'collecting';
  private terminalError: Error | null = null;
  private failureNotified = false;
  private sealedPublication: BuildSessionPublication<TData> | null = null;
  private publishPromise: Promise<TResult> | null = null;

  constructor(
    identity: BuildSessionIdentity,
    participants: readonly BuildParticipant[],
    postprocessors: readonly string[],
    callbacks: BuildSessionCallbacks<TData, TResult>
  ) {
    this.identity = Object.freeze({ ...identity });
    this.callbacks = callbacks;

    for (const participant of participants) {
      assertNonEmpty(participant.name, 'Participant name');
      if (this.participants.has(participant.name)) {
        throw new BuildSessionStateError(
          `Build participant "${participant.name}" was registered more than once`
        );
      }
      this.participants.set(participant.name, {
        name: participant.name,
        role: participant.role ?? participant.name,
        required: participant.required ?? true,
      });
    }

    for (const postprocessor of postprocessors) {
      assertNonEmpty(postprocessor, 'Postprocessor name');
      if (this.postprocessors.has(postprocessor)) {
        throw new BuildSessionStateError(
          `Build postprocessor "${postprocessor}" was registered more than once`
        );
      }
      this.postprocessors.add(postprocessor);
    }

    this.resolveBarrierWhenReady();
  }

  get status(): BuildSessionStatus {
    return this.state;
  }

  /** Terminal failure, exposed so an ApplicationContext can refuse unsafe supersession. */
  get failure(): Error | null {
    return this.terminalError;
  }

  get readiness(): BuildSessionReadiness {
    const pendingParticipants = [...this.participants.values()]
      .filter(
        (participant) =>
          participant.required && !this.completedParticipants.has(participant.name)
      )
      .map((participant) => participant.name);
    const pendingPostprocessors = [...this.postprocessors].filter(
      (postprocessor) => !this.completedPostprocessors.has(postprocessor)
    );

    return Object.freeze({
      ready: pendingParticipants.length === 0 && pendingPostprocessors.length === 0,
      pendingParticipants: Object.freeze(pendingParticipants),
      pendingPostprocessors: Object.freeze(pendingPostprocessors),
    });
  }

  get isTerminal(): boolean {
    return (
      this.state === 'published' || this.state === 'failed' || this.state === 'aborted'
    );
  }

  contribute(contribution: BuildContribution<TData>): void {
    this.assertCollecting('contribute assets');
    const participant = this.participants.get(contribution.participant);
    if (!participant) {
      throw new BuildSessionStateError(
        `Unknown build participant "${contribution.participant}"`
      );
    }
    if (this.completedParticipants.has(contribution.participant)) {
      throw new BuildSessionStateError(
        `Build participant "${contribution.participant}" is already complete`
      );
    }
    assertNonEmpty(contribution.key, 'Contribution key');

    let participantContributions = this.contributions.get(contribution.participant);
    if (!participantContributions) {
      participantContributions = new Map();
      this.contributions.set(contribution.participant, participantContributions);
    }
    participantContributions.set(contribution.key, {
      ...contribution,
      assetsMap: cloneAssetsMap(contribution.assetsMap),
    });
  }

  completeParticipant(participant: string): void {
    this.assertCollecting('complete a participant');
    if (!this.participants.has(participant)) {
      throw new BuildSessionStateError(`Unknown build participant "${participant}"`);
    }
    this.completedParticipants.add(participant);
    this.resolveBarrierWhenReady();
  }

  completePostprocess(postprocessor: string): void {
    this.assertCollecting('complete postprocessing');
    if (!this.postprocessors.has(postprocessor)) {
      throw new BuildSessionStateError(`Unknown build postprocessor "${postprocessor}"`);
    }
    this.completedPostprocessors.add(postprocessor);
    this.resolveBarrierWhenReady();
  }

  fail(participant: string, cause: unknown): void {
    if (!this.participants.has(participant)) {
      throw new BuildSessionStateError(`Unknown build participant "${participant}"`);
    }
    if (this.terminalError instanceof BuildSessionRollbackError) {
      throw this.terminalError;
    }
    if (this.isTerminal) {
      return;
    }
    if (this.state === 'publishing') {
      throw new BuildSessionStateError(
        'Cannot fail a build participant after its publisher has started'
      );
    }
    this.rejectSession(new BuildParticipantFailedError(participant, cause), 'failed');
  }

  abort(reason?: unknown): void {
    if (this.terminalError instanceof BuildSessionRollbackError) {
      throw this.terminalError;
    }
    if (this.isTerminal) {
      return;
    }
    if (this.state === 'publishing') {
      throw new BuildSessionStateError(
        'Cannot abort a build session after its publisher has started'
      );
    }
    this.rejectSession(new BuildSessionAbortedError(reason), 'aborted');
  }

  /** Validate, merge, and freeze the complete publication without uploading it. */
  seal(): BuildSessionPublication<TData> {
    if (this.sealedPublication) {
      return this.sealedPublication;
    }
    if (this.terminalError) {
      throw this.terminalError;
    }
    if (this.state !== 'collecting') {
      throw new BuildSessionStateError(
        `Cannot seal a build session while it is ${this.state}`
      );
    }
    const readiness = this.readiness;
    if (!readiness.ready) {
      throw new BuildSessionNotReadyError(readiness);
    }

    this.sealedPublication = this.createPublication();
    this.state = 'sealed';
    return this.sealedPublication;
  }

  /**
   * Wait for the completion/postprocess barrier and publish exactly once. Every caller
   * receives the same in-flight promise and result.
   */
  publish(): Promise<TResult> {
    if (!this.publishPromise) {
      this.publishPromise = this.runPublish();
    }
    return this.publishPromise;
  }

  private async runPublish(): Promise<TResult> {
    try {
      await this.barrier.promise;
      if (this.terminalError) {
        throw this.terminalError;
      }

      const publication = this.seal();
      this.state = 'publishing';
      await this.callbacks.prepare?.(this.identity);
      const result = await this.callbacks.publish(publication);
      await this.callbacks.finish?.(publication, result);
      this.state = 'published';
      return result;
    } catch (error: unknown) {
      if (this.state !== 'aborted') {
        this.state = 'failed';
      }
      if (!this.terminalError) {
        this.terminalError = error instanceof Error ? error : new Error(String(error));
      }
      this.notifyFailure();
      throw this.terminalError;
    }
  }

  private createPublication(): BuildSessionPublication<TData> {
    const assetsMap: ZeBuildAssetsMap = {};
    const assetsByPath = new Map<string, ZeBuildAsset>();
    const assetsByHash = new Map<string, ZeBuildAsset>();
    const publishedContributions: PublishedBuildContribution<TData>[] = [];

    for (const participant of this.participants.values()) {
      const participantContributions = this.contributions.get(participant.name);
      if (!participantContributions) {
        continue;
      }

      for (const contribution of participantContributions.values()) {
        const publishedContribution: PublishedBuildContribution<TData> = {
          ...contribution,
          role: participant.role,
          assetsMap: Object.freeze({ ...contribution.assetsMap }),
        };
        publishedContributions.push(Object.freeze(publishedContribution));

        for (const incoming of Object.values(contribution.assetsMap)) {
          const normalizedPath = normalizeAssetPath(incoming.path);
          const samePath = assetsByPath.get(normalizedPath);
          if (samePath && !sameAsset(samePath, incoming)) {
            throw new BuildSessionAssetCollisionError(
              normalizedPath,
              samePath.hash,
              incoming.hash
            );
          }

          const sameHash = assetsByHash.get(incoming.hash);
          if (sameHash && !sameAsset(sameHash, incoming)) {
            throw new BuildSessionAssetCollisionError(
              incoming.path,
              sameHash.hash,
              incoming.hash
            );
          }

          if (!samePath && !sameHash) {
            assetsByPath.set(normalizedPath, incoming);
            assetsByHash.set(incoming.hash, incoming);
            assetsMap[incoming.hash] = incoming;
          }
        }
      }
    }

    return Object.freeze({
      identity: this.identity,
      assetsMap: Object.freeze(assetsMap),
      contributions: Object.freeze(publishedContributions),
    });
  }

  private resolveBarrierWhenReady(): void {
    if (this.state === 'collecting' && this.readiness.ready) {
      this.barrier.resolve();
    }
  }

  private rejectSession(
    error: Error,
    status: Extract<BuildSessionStatus, 'failed' | 'aborted'>
  ): void {
    this.terminalError = error;
    this.state = status;
    this.notifyFailure();
    this.barrier.reject(this.terminalError);

    // fail() and abort() are synchronous lifecycle operations. If rollback failed,
    // surface that failure before a caller can begin a replacement generation.
    if (this.terminalError instanceof BuildSessionRollbackError) {
      throw this.terminalError;
    }
  }

  private notifyFailure(): void {
    if (this.failureNotified || !this.terminalError) {
      return;
    }
    this.failureNotified = true;
    try {
      this.callbacks.onFailure?.(this.identity, this.terminalError);
    } catch (cleanupError: unknown) {
      const normalizedCleanupError =
        cleanupError instanceof Error ? cleanupError : new Error(String(cleanupError));
      this.terminalError = new BuildSessionRollbackError(
        this.terminalError,
        normalizedCleanupError
      );
    }
  }

  private assertCollecting(action: string): void {
    if (this.state !== 'collecting') {
      throw new BuildSessionStateError(
        `Cannot ${action} while build session is ${this.state}`
      );
    }
  }
}
