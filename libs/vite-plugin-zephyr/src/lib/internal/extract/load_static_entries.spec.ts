import { beforeEach, describe, expect, it, rs } from '@rstest/core';
import type { Mock } from '@rstest/core';
import { readDirRecursiveWithContents } from 'zephyr-agent';
import { load_static_entries } from './load_static_entries';

rs.mock('zephyr-agent', () => ({
  readDirRecursiveWithContents: rs.fn(),
}));

const mockReadDirRecursiveWithContents = readDirRecursiveWithContents as Mock<
  typeof readDirRecursiveWithContents
>;

describe('load_static_entries', () => {
  beforeEach(() => {
    rs.clearAllMocks();
    mockReadDirRecursiveWithContents.mockResolvedValue([]);
  });

  it('reads ignored TAP package paths without suppressing filesystem errors', async () => {
    await load_static_entries({ root: '/repo', outDir: 'dist', target: 'tap-app' });

    expect(mockReadDirRecursiveWithContents).toHaveBeenCalledWith('/repo/dist', {
      includeIgnoredPaths: true,
      failOnError: true,
    });
  });

  it('uses the ordinary recursive-reader defaults for web output', async () => {
    await load_static_entries({ root: '/repo', outDir: 'dist' });

    expect(mockReadDirRecursiveWithContents).toHaveBeenCalledWith('/repo/dist');
  });
});
