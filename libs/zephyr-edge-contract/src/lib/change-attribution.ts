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

/** Attribution is private local evidence, never an API payload. */
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
  storage?: 'local';
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
