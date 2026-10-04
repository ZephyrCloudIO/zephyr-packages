import { describe, expect, it } from '@rstest/core';
import { summarizeAttributionChanges } from './report';
import type { AttributedFileDiff } from './compare';

describe('local attribution report', () => {
  it('counts net additions and original removal origins without copying evidence', () => {
    const changes: AttributedFileDiff[] = [
      {
        file: 'private/customer.ts',
        status: 'modified',
        binary: false,
        patch: 'private patch',
        lines: [
          {
            operation: 'add',
            line: 1,
            text: 'private AI source',
            origin: {
              kind: 'ai',
              evidence: 'git-ai-checkpoint',
              human: 'private person',
              session: 'private session',
              model: 'private model',
            },
          },
          {
            operation: 'add',
            line: 2,
            text: 'private source',
            origin: { kind: 'unknown', evidence: 'none' },
          },
          {
            operation: 'remove',
            line: 1,
            text: 'private original',
            origin: { kind: 'human', evidence: 'git-ai-blame', human: 'original author' },
          },
        ],
      },
      {
        file: 'private/binary',
        status: 'added',
        binary: true,
        patch: 'private binary',
        lines: [],
      },
      { file: 'private/empty', status: 'deleted', binary: false, patch: '', lines: [] },
    ];
    const result = summarizeAttributionChanges(changes);
    expect(result).toEqual({
      files: { changed: 3, added: 1, modified: 1, deleted: 1, binary: 1 },
      lines: {
        added: { total: 2, ai: 1, human: 0, unknown: 1 },
        removed: { total: 1, ai: 0, human: 1, unknown: 0 },
      },
    });
    expect(JSON.stringify(result)).not.toMatch(/private|original author/);
  });
  it('keeps empty comparisons at zero without inventing human attribution', () => {
    expect(summarizeAttributionChanges([]).lines).toEqual({
      added: { total: 0, ai: 0, human: 0, unknown: 0 },
      removed: { total: 0, ai: 0, human: 0, unknown: 0 },
    });
  });
});
