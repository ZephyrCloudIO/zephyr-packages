import type { Dirent, PathLike } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { walkFiles } from '../files/walkFiles';

jest.mock('node:fs/promises');

const mockedFs = fs as jest.Mocked<typeof fs>;

describe('walkFiles', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('recursively lists all files in nested directories', async () => {
    mockedFs.readdir.mockImplementation(async (dir: PathLike) => {
      const dirStr = dir.toString();

      const mockDirent = (name: string, isDir: boolean): Dirent =>
        ({
          name,
          isDirectory: () => isDir,
          isFile: () => !isDir,
          isBlockDevice: () => false,
          isCharacterDevice: () => false,
          isFIFO: () => false,
          isSocket: () => false,
          isSymbolicLink: () => false,
        }) as unknown as Dirent;

      switch (dirStr) {
        case 'root':
          return [mockDirent('a.txt', false), mockDirent('sub', true)];
        case path.join('root', 'sub'):
          return [mockDirent('b.txt', false), mockDirent('deep', true)];
        case path.join('root', 'sub', 'deep'):
          return [mockDirent('c.txt', false)];
        default:
          return [];
      }
    });

    const result = await walkFiles('root');

    expect(result).toEqual([
      'a.txt',
      path.join('sub', 'b.txt'),
      path.join('sub', 'deep', 'c.txt'),
    ]);
  });

  it('returns an empty array for an empty directory', async () => {
    mockedFs.readdir.mockImplementation(async () => []);
    const result = await walkFiles('empty');
    expect(result).toEqual([]);
  });

  it('skips symbolic links to avoid infinite loops', async () => {
    mockedFs.readdir.mockImplementation(async (dir: PathLike) => {
      const mockDirent = (name: string, isDir: boolean, isSymlink = false): Dirent =>
        ({
          name,
          isDirectory: () => isDir,
          isFile: () => !isDir,
          isBlockDevice: () => false,
          isCharacterDevice: () => false,
          isFIFO: () => false,
          isSocket: () => false,
          isSymbolicLink: () => isSymlink,
        }) as unknown as Dirent;

      if (dir.toString() === 'loop') {
        return [
          mockDirent('link', true, true), // Simulated symlink to directory
          mockDirent('real.txt', false),
        ];
      }

      return [];
    });

    const result = await walkFiles('loop');
    expect(result).toEqual(['real.txt']);
  });
});
