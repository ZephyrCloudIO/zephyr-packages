import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { ZephyrError } from 'zephyr-agent';
import type { Source } from 'zephyr-edge-contract';
import { buildAssetMapFromFiles } from '../assets/buildAssets';

describe('buildAssetMapFromFiles', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'rspress-assets-'));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('builds an asset map with Source objects for each file', async () => {
    const files = ['file1.js', path.join('nested', 'file2.css')];
    await mkdir(path.join(root, 'nested'), { recursive: true });

    const file1Buffer = Buffer.from('console.log("file1");');
    const file2Buffer = Buffer.from('body { margin: 0; }');
    await writeFile(path.join(root, 'file1.js'), file1Buffer);
    await writeFile(path.join(root, 'nested', 'file2.css'), file2Buffer);

    const result = await buildAssetMapFromFiles(root, files);

    expect(Object.keys(result)).toEqual(files);

    for (const relPath of files) {
      const source: Source = result[relPath];
      const expectedBuffer =
        relPath === 'file1.js'
          ? file1Buffer
          : Buffer.from('body { margin: 0; }');

      expect(source).toBeDefined();
      expect(source.source()).toEqual(expectedBuffer);
      expect(source.size()).toBe(expectedBuffer.length);
      expect(source.buffer()).toEqual(expectedBuffer);
    }
  });

  it('throws if fs.readFile fails', async () => {
    await expect(buildAssetMapFromFiles(root, ['x.js'])).rejects.toThrow();
  });

  it('throws ZephyrError for path traversal attempt', async () => {
    const files = ['../outside.js'];

    await expect(buildAssetMapFromFiles(root, files)).rejects.toThrow(
      ZephyrError
    );
    await expect(buildAssetMapFromFiles(root, files)).rejects.toThrow(
      /Invalid file path/
    );
  });

  it('should reject path traversal attempts', async () => {
    await expect(
      buildAssetMapFromFiles(root, ['../../../etc/passwd'])
    ).rejects.toThrow('Invalid file path');
  });
});
