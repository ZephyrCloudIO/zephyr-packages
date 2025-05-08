import { buildAssetMapFromFiles } from '../assets/buildAssets';
import fs from 'node:fs/promises';
import path from 'node:path';
import { PathLike } from 'node:fs';
import { Source } from 'zephyr-edge-contract';

jest.mock('node:fs/promises');
const mockedFs = fs as jest.Mocked<typeof fs>;

describe('buildAssetMapFromFiles', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('builds an asset map with Source objects for each file', async () => {
    const root = '/root';
    const files = ['file1.js', 'nested/file2.css'];

    const buffers: Record<string, Buffer> = {
      [path.join(root, 'file1.js')]: Buffer.from('console.log("file1");'),
      [path.join(root, 'nested/file2.css')]: Buffer.from('body { margin: 0; }'),
    };

    mockedFs.readFile.mockImplementation(async (filePath: PathLike | fs.FileHandle) => {
      const key = filePath.toString();
      const buffer = buffers[key];
      if (!buffer) throw new Error(`File not found: ${key}`);
      return buffer;
    });

    const result = await buildAssetMapFromFiles(root, files);

    expect(Object.keys(result)).toEqual(['file1.js', 'nested/file2.css']);

    for (const relPath of files) {
      const source: Source = result[relPath];
      const absPath = path.join(root, relPath);
      const expectedBuffer = buffers[absPath];

      expect(source).toBeDefined();
      expect(source.source()).toEqual(expectedBuffer);
      expect(source.size()).toBe(expectedBuffer.length);
      expect(source.buffer()).toEqual(expectedBuffer);
    }
  });

  it('throws if fs.readFile fails', async () => {
    mockedFs.readFile.mockRejectedValue(new Error('read error'));

    await expect(buildAssetMapFromFiles('/root', ['x.js'])).rejects.toThrow('read error');
  });
});
