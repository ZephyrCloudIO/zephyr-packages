import type { ArtifactOutcome, NativeCacheFailureReason } from './types';

export class NativeCacheLoadError extends Error {
  readonly reason: NativeCacheFailureReason;
  readonly outcome: ArtifactOutcome;

  constructor(outcome: ArtifactOutcome) {
    super(`Native cache load failed: ${outcome.reason ?? 'storage-failure'}`);
    this.name = 'NativeCacheLoadError';
    this.reason = outcome.reason ?? 'storage-failure';
    this.outcome = outcome;
  }
}
