import { rs } from '@rstest/core';
import { mkdtemp, rm, truncate, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { showFiles } from '../files/showFiles';

const zeLogPackageMock = rs.fn();

rs.mock('zephyr-agent', () => ({
  ze_log: {
    package: (...args: unknown[]) => zeLogPackageMock(...args),
  },
}));

describe('showFiles', () => {
  let rootDir: string;

  beforeEach(async () => {
    rs.clearAllMocks();
    rootDir = await mkdtemp(path.join(tmpdir(), 'show-files-'));
  });

  afterEach(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  it('logs size for each file', async () => {
    const files = ['a.js', 'b.css'];

    await writeFile(path.join(rootDir, 'a.js'), '');
    await writeFile(path.join(rootDir, 'b.css'), '');
    await truncate(path.join(rootDir, 'a.js'), 2048);
    await truncate(path.join(rootDir, 'b.css'), 1024);

    await showFiles(rootDir, files);

    expect(zeLogPackageMock).toHaveBeenCalledWith('a.js — 2.00 KB');
    expect(zeLogPackageMock).toHaveBeenCalledWith('b.css — 1.00 KB');
  });

  it('logs error for file that fails stat', async () => {
    const files = ['good.js', 'bad.js'];
    await writeFile(path.join(rootDir, 'good.js'), '');
    await truncate(path.join(rootDir, 'good.js'), 1000);

    await showFiles(rootDir, files);

    expect(zeLogPackageMock).toHaveBeenCalledWith('good.js — 0.98 KB');
    expect(zeLogPackageMock).toHaveBeenCalledWith(
      'Failed to stat file: bad.js'
    );
  });

  it('logs message for empty file list', async () => {
    await showFiles(rootDir, []);
    expect(zeLogPackageMock).toHaveBeenCalledWith(
      'No files found in output directory.'
    );
  });
});
