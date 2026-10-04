import { compareSourceRecords, type AttributedFileDiff } from './compare';

export interface AttributionLineCounts {
  total: number;
  human: number;
  ai: number;
  unknown: number;
}

/** Portable local analytics only: no paths, source text, identities, or sessions. */
export interface LocalAttributionReport {
  kind: 'zephyr-local-attribution-report';
  schemaVersion: 1;
  identity: 'self-reported';
  generatedAt: string;
  before: string;
  after: string;
  beforeFingerprint: string;
  afterFingerprint: string;
  sameCommit: boolean;
  files: {
    changed: number;
    added: number;
    modified: number;
    deleted: number;
    binary: number;
  };
  lines: { added: AttributionLineCounts; removed: AttributionLineCounts };
}

export function summarizeAttributionChanges(changes: AttributedFileDiff[]) {
  const counts = (): AttributionLineCounts => ({ total: 0, human: 0, ai: 0, unknown: 0 });
  const files = { changed: changes.length, added: 0, modified: 0, deleted: 0, binary: 0 };
  const lines = { added: counts(), removed: counts() };
  for (const change of changes) {
    files[change.status]++;
    if (change.binary) {
      files.binary++;
      continue;
    }
    for (const line of change.lines) {
      const count = line.operation === 'add' ? lines.added : lines.removed;
      count.total++;
      count[line.origin.kind]++;
    }
  }
  return { files, lines };
}

export function createLocalAttributionReport(
  directory: string,
  before: string,
  after: string
): LocalAttributionReport {
  const difference = compareSourceRecords(directory, before, after);
  return {
    kind: 'zephyr-local-attribution-report',
    schemaVersion: 1,
    identity: 'self-reported',
    generatedAt: new Date().toISOString(),
    before: difference.before,
    after: difference.after,
    beforeFingerprint: difference.beforeFingerprint,
    afterFingerprint: difference.afterFingerprint,
    sameCommit: difference.sameCommit,
    ...summarizeAttributionChanges(difference.changes),
  };
}
