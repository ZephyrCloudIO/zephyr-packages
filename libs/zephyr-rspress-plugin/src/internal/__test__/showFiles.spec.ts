import { walkFiles } from '../files/walkFiles';
import fs from 'node:fs/promises';
import path from 'node:path';

jest.mock('node:fs/promises');

const mockedFs = fs as jest.Mocked<typeof fs>;

describe('walkFiles', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should return flat list of files in a directory', async () => {
    mockedFs.readdir.mockImplementation(async (dir) => {
      if (dir === 'test') {
        return [
          { name: 'file1.txt', isDirectory: () => false },
          { name: 'sub', isDirectory: () => true },
        ] as any;
      } else if (dir === path.join('test', 'sub')) {
        return [{ name: 'file2.txt', isDirectory: () => false }] as any;
      }
      return [];
    });

    const result = await walkFiles('test');
    expect(result).toEqual(['file1.txt', path.join('sub', 'file2.txt')]);
  });

  it('should return an empty array if directory is empty', async () => {
    mockedFs.readdir.mockResolvedValue([] as any);
    const result = await walkFiles('empty');
    expect(result).toEqual([]);
  });
});
