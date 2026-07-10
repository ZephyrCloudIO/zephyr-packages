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
});
