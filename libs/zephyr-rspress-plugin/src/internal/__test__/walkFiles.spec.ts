import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { walkFiles } from '../files/walkFiles';

describe('walkFiles', () => {
  let rootDir: string;

  beforeEach(async () => {
    rootDir = await mkdtemp(path.join(tmpdir(), 'walk-files-'));
  });

  afterEach(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  it('recursively lists all files in nested directories', async () => {
    await mkdir(path.join(rootDir, 'sub', 'deep'), { recursive: true });
    await writeFile(path.join(rootDir, 'a.txt'), 'a');
    await writeFile(path.join(rootDir, 'sub', 'b.txt'), 'b');
    await writeFile(path.join(rootDir, 'sub', 'deep', 'c.txt'), 'c');

    const result = await walkFiles(rootDir);

    expect(result.sort()).toEqual([
      'a.txt',
      path.join('sub', 'b.txt'),
      path.join('sub', 'deep', 'c.txt'),
    ]);
  });

  it('returns an empty array for an empty directory', async () => {
    const result = await walkFiles(rootDir);
    expect(result).toEqual([]);
  });

  it('skips symbolic links to avoid infinite loops', async () => {
    await mkdir(path.join(rootDir, 'real-dir'), { recursive: true });
    await writeFile(path.join(rootDir, 'real.txt'), 'real');
    await writeFile(path.join(rootDir, 'real-dir', 'nested.txt'), 'nested');
    await symlink(path.join(rootDir, 'real-dir'), path.join(rootDir, 'link-to-dir'));

    const result = await walkFiles(rootDir);

    expect(result.sort()).toEqual([path.join('real-dir', 'nested.txt'), 'real.txt']);
    expect(result).not.toContain(path.join('link-to-dir', 'nested.txt'));
  });
});
