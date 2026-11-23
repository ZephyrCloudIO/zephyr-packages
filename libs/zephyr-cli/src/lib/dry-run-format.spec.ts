// BDD description (unit tests are generated from this description):
//
// Feature: dry run report
//
//   Scenario: text report
//     Given a dry run result with files and excluded files
//     Then each file is listed with a human-readable size and exact bytes
//     And each excluded file is listed with its reason and rule, and a total line follows
//
//   Scenario: no exclusions
//     Given a result with no excluded files
//     Then the Excluded section is omitted
//
//   Scenario: empty result and size units
//     Given no files, or sizes of 0 B, 1536 bytes and 5 MiB
//     Then the report shows 0 files and the sizes use B, KiB and MiB
import { describe, expect, it } from '@rstest/core';
import type { DeployDryRunResult } from '../commands/deploy';
import { formatDryRun, formatSize } from './dry-run-format';

const result: DeployDryRunResult = {
  dryRun: true,
  root: '/tmp/out',
  files: [{ path: 'index.js', size: 1536 }],
  excluded: [{ path: '.env', reason: 'denylist', rule: '.env' }],
  fileCount: 1,
  totalSize: 1536,
};

describe('formatDryRun', () => {
  it('lists files, exclusions and the total', () => {
    const text = formatDryRun(result);
    expect(text).toContain('Upload root: /tmp/out');
    expect(text).toContain('index.js  1.5 KiB (1536 bytes)');
    expect(text).toContain('.env  denylist: .env');
    expect(text).toContain('Total: 1 files, 1.5 KiB (1536 bytes)');
  });

  it('omits the Excluded section when nothing was excluded', () => {
    expect(formatDryRun({ ...result, excluded: [] })).not.toContain('Excluded');
  });

  it('handles an empty result', () => {
    const text = formatDryRun({ ...result, files: [], fileCount: 0, totalSize: 0 });
    expect(text).toContain('Files to upload (0):');
    expect(text).toContain('Total: 0 files, 0 B (0 bytes)');
  });
});

describe('formatSize', () => {
  it('uses B, KiB and MiB', () => {
    expect(formatSize(0)).toBe('0 B');
    expect(formatSize(1536)).toBe('1.5 KiB');
    expect(formatSize(5 * 1024 * 1024)).toBe('5.0 MiB');
  });
});
