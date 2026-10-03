/** Instrumented provenance is self-reported evidence, not verified identity. */
export interface ChangeOrigin {
  kind: 'human' | 'ai' | 'unknown';
  human?: string;
  tool?: string;
  model?: string;
  session?: string;
  evidence: 'git-ai-checkpoint' | 'git-ai-blame' | 'none';
}

export interface ChangeAttributionRange {
  start: number;
  end: number;
  origin: ChangeOrigin;
}

/** Source text stays in the developer's private Git directory. */
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
  files?: Record<
    string,
    {
      hash: string;
      mode: string;
      attribution: ChangeAttributionRange[];
    }
  >;
}
