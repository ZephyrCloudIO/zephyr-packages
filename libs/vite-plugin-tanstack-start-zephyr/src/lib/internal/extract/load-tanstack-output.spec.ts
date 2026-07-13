import { beforeEach, describe, expect, it, rs } from '@rstest/core';
import type { Mock } from '@rstest/core';

import { readDirRecursiveWithContents } from 'zephyr-agent';
import { loadFilesFromDirectory } from './load-tanstack-output';

rs.mock('zephyr-agent', () => ({
  readDirRecursiveWithContents: rs.fn(),
}));

const mockReadDirRecursiveWithContents = readDirRecursiveWithContents as Mock<
  typeof readDirRecursiveWithContents
>;

describe('loadFilesFromDirectory', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  it('normalizes Windows asset paths for snapshot entrypoint matching', async () => {
    mockReadDirRecursiveWithContents.mockResolvedValue([
      {
        fullPath: String.raw`D:\repo\app\dist\server\index.js`,
        relativePath: String.raw`server\index.js`,
        content: Buffer.from('export default {}'),
      },
    ]);

    const bundle = await loadFilesFromDirectory(String.raw`D:\repo\app\dist`);

    expect(Object.keys(bundle)).toEqual(['server/index.js']);
    expect(bundle['server/index.js']).toEqual(
      expect.objectContaining({
        type: 'chunk',
        fileName: 'server/index.js',
        preliminaryFileName: 'server/index.js',
      })
    );
  });

  it('keeps non-UTF-8 mjs bytes as a raw asset for tap-app', async () => {
    const emitted = Buffer.from([0x80, 0xff, 0x00, 0xfe, 0x7f]);
    mockReadDirRecursiveWithContents.mockResolvedValue([
      {
        fullPath: '/repo/app/dist/server/entry.mjs',
        relativePath: 'server/entry.mjs',
        content: emitted,
      },
    ]);

    const bundle = await loadFilesFromDirectory('/repo/app/dist', {
      target: 'tap-app',
    });
    const output = bundle['server/entry.mjs'];

    expect(output).toEqual(
      expect.objectContaining({
        type: 'asset',
        fileName: 'server/entry.mjs',
        source: emitted,
      })
    );
    expect((output as { source: Buffer }).source).toBe(emitted);
    expect(mockReadDirRecursiveWithContents).toHaveBeenCalledWith('/repo/app/dist', {
      includeIgnoredPaths: true,
      failOnError: true,
    });
  });

  it('retains otherwise ignored TAP package files as byte-backed assets', async () => {
    const sourceMap = Buffer.from('{"version":3}');
    const opaqueRuntime = Buffer.from([0, 255, 3]);
    mockReadDirRecursiveWithContents.mockResolvedValue([
      {
        fullPath: '/repo/app/dist/targets/desktop/remoteEntry.mjs.map',
        relativePath: 'targets/desktop/remoteEntry.mjs.map',
        content: sourceMap,
      },
      {
        fullPath: '/repo/app/dist/node_modules/runtime/opaque.bin',
        relativePath: 'node_modules/runtime/opaque.bin',
        content: opaqueRuntime,
      },
    ]);

    const bundle = await loadFilesFromDirectory('/repo/app/dist', { target: 'tap-app' });

    expect(bundle['targets/desktop/remoteEntry.mjs.map']).toEqual(
      expect.objectContaining({ type: 'asset', source: sourceMap })
    );
    expect(bundle['node_modules/runtime/opaque.bin']).toEqual(
      expect.objectContaining({ type: 'asset', source: opaqueRuntime })
    );
  });
});
