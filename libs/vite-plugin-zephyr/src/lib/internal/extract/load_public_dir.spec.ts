import { beforeEach, describe, expect, it, rs } from '@rstest/core';
import type { Mock } from '@rstest/core';
import { readDirRecursiveWithContents } from 'zephyr-agent';
import { load_public_dir } from './load_public_dir';

rs.mock('zephyr-agent', () => ({
  readDirRecursiveWithContents: rs.fn(),
}));

const mockReadDirRecursiveWithContents = readDirRecursiveWithContents as Mock<
  typeof readDirRecursiveWithContents
>;

describe('load_public_dir', () => {
  beforeEach(() => {
    rs.clearAllMocks();
    mockReadDirRecursiveWithContents.mockResolvedValue([]);
  });

  it('reads every TAP package artifact and surfaces filesystem failures', async () => {
    await load_public_dir({
      publicDir: '/repo/public',
      outDir: '/repo/dist',
      target: 'tap-app',
    });

    expect(mockReadDirRecursiveWithContents).toHaveBeenCalledWith('/repo/public', {
      includeIgnoredPaths: true,
      failOnError: true,
    });
  });

  it('keeps conventional public-directory filtering behavior by default', async () => {
    await load_public_dir({ publicDir: '/repo/public', outDir: '/repo/dist' });

    expect(mockReadDirRecursiveWithContents).toHaveBeenCalledWith('/repo/public');
  });
});
