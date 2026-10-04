/** Instrumented provenance is self-reported evidence, not verified identity. */
export interface ChangeOrigin {
  kind: 'human' | 'ai' | 'unknown';
  human?: string;
  tool?: string;
  model?: string;
  session?: string;
  /** Per-turn metadata. Harness and initiator claims remain self-reported. */
  harness?: string;
  agent?: string;
  provider?: string;
  reasoningEffort?: string;
  turn?: string;
  turnAssociation?: 'native-turn-id' | 'active-prompt';
  toolCall?: string;
  promptInitiator?: { id: string; evidence: 'launcher-self-report' };
  evidence: 'git-ai-checkpoint' | 'git-ai-blame' | 'none';
}

/** One observed session/turn, referenced by contributors; never add costs per line. */
export interface ChangeSession {
  agent: string;
  session: string;
  turn: string;
  turnAssociation?: ChangeOrigin['turnAssociation'];
  harness?: string;
  provider?: string;
  model?: string;
  reasoningEffort?: string;
  promptInitiator?: ChangeOrigin['promptInitiator'];
  capturedAt: string;
  evidence: 'codex-hook' | 'codex-hook-and-rollout' | 'grok-hook-and-session';
  usage?: {
    /** Cumulative session counters through this turn; snapshots are not additive. */
    scope: 'session-cumulative';
    inputTokens?: number;
    cachedInputTokens?: number;
    cacheWriteInputTokens?: number;
    outputTokens?: number;
    reasoningOutputTokens?: number;
    totalTokens?: number;
    observedAt?: string;
    incomplete?: boolean;
  };
  cost:
    | { status: 'unavailable'; reason: string }
    | {
        status: 'reported';
        currency: 'USD';
        usdTicks: number;
        scope: 'session-cumulative';
        partial: boolean;
        observedAt?: string;
      };
}

export interface ChangeAttributionRange {
  start: number;
  end: number;
  origin: ChangeOrigin;
}

export interface AttributionContentOptions {
  /** Unified dirty-source patch against the captured Git HEAD. */
  patch?: boolean;
  /** Text and attribution of added/removed lines, not full source files. */
  lines?: boolean;
}

/** Authenticated application configuration; account tier never comes from repo JSON. */
export interface AttributionRepositoryPolicy {
  schemaVersion: 1;
  repositoryId: string;
  revision: string;
  storage: 'local' | 'remote';
  tier: 'free' | 'paid' | 'byoc';
  /** Server content allowlist; paid/BYOC repo preferences default to off. */
  content: { patch: boolean; lines: boolean };
}

export interface AttributionStoredChange {
  file: string;
  status: 'added' | 'deleted' | 'modified';
  binary: boolean;
  beforeMode?: string;
  afterMode?: string;
  patch?: string;
  lines?: {
    operation: 'add' | 'remove';
    line: number;
    text: string;
    origin: ChangeOrigin;
  }[];
}

/** POST /attribution: a private control-plane record, never a public build asset. */
export interface AttributionUploadRequest {
  schemaVersion: 1;
  applicationUid: string;
  repositoryId: string;
  buildId: string;
  snapshotId: string;
  policyRevision: string;
  content: { patch: boolean; lines: boolean };
  attribution: ChangeAttribution;
  comparison?: {
    base: 'git-head';
    baseCommit: string;
    changes: AttributionStoredChange[];
  };
}

export interface AttributionUploadResponse {
  status: 'ok';
  recordId: string;
  applicationUid: string;
  repositoryId: string;
  buildId: string;
  snapshotId: string;
  sourceFingerprint: string;
}

/** Full evidence stays local or in the dedicated private attribution service. */
export interface ChangeAttribution {
  schemaVersion: 1;
  status: 'captured' | 'unavailable';
  reason?: string;
  sourceId?: string;
  startSourceId?: string;
  sourceFingerprint?: string;
  startSourceFingerprint?: string;
  baseCommit?: string;
  dirty?: boolean;
  capturedAt?: string;
  scope: 'git-working-tree';
  consistency:
    | 'boundary-match'
    | 'changed-during-build'
    | 'publication-only'
    | 'unavailable';
  identity: 'self-reported';
  storage?: 'local' | 'remote';
  remote?: { recordId: string; repositoryId: string; policyRevision: string };
  /** Git identity associated with the capture, not proof of who edited/prompted. */
  workspaceHuman?: string;
  sessions?: Record<string, ChangeSession>;
  files?: Record<
    string,
    {
      hash: string;
      mode: string;
      attribution: ChangeAttributionRange[];
    }
  >;
}
