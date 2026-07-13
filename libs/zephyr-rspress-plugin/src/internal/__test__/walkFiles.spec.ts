import { beforeEach, describe, expect, it, rs } from '@rstest/core';
import type { Mock } from '@rstest/core';

import { readDirRecursive } from 'zephyr-agent';
import { walkFiles } from '../files/walkFiles';

rs.mock('zephyr-agent', () => ({
  readDirRecursive: rs.fn(),
}));

describe('walkFiles', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  it('normalizes Windows relative paths to POSIX snapshot keys before asset mapping', async () => {
    (readDirRecursive as Mock).mockResolvedValue([
      {
        fullPath: 'C:\\package\\dist\\targets\\desktop\\remoteEntry.mjs',
        relativePath: 'targets\\desktop\\remoteEntry.mjs',
      },
      {
        fullPath: 'C:\\package\\dist\\manifest.tap.json',
        relativePath: 'manifest.tap.json',
      },
    ]);

    await expect(walkFiles('C:\\package\\dist', 'package\\artifacts')).resolves.toEqual([
      'package/artifacts/targets/desktop/remoteEntry.mjs',
      'package/artifacts/manifest.tap.json',
    ]);
    expect(readDirRecursive).toHaveBeenCalledWith('C:\\package\\dist');
  });

  it('uses the complete fail-closed reader for tap-app output', async () => {
    (readDirRecursive as Mock).mockResolvedValue([
      {
        fullPath: '/dist/node_modules/runtime/opaque.bin',
        relativePath: 'node_modules/runtime/opaque.bin',
      },
      {
        fullPath: '/dist/remoteEntry.mjs.map',
        relativePath: 'remoteEntry.mjs.map',
      },
    ]);

    await expect(walkFiles('/dist', '', 'tap-app')).resolves.toEqual([
      'node_modules/runtime/opaque.bin',
      'remoteEntry.mjs.map',
    ]);
    expect(readDirRecursive).toHaveBeenCalledWith('/dist', {
      includeIgnoredPaths: true,
      failOnError: true,
    });
  });
});
