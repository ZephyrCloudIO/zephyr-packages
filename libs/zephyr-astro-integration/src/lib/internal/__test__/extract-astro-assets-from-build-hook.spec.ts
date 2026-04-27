import { rs } from '@rstest/core';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { extractAstroAssetsFromBuildHook } from '../extract-astro-assets-map';

const buildAssetsMapMock = rs.fn();

rs.mock('zephyr-agent', () => ({
  buildAssetsMap: (...args: unknown[]) => buildAssetsMapMock(...args),
  logFn: rs.fn(),
}));

describe('extractAstroAssetsFromBuildHook', () => {
  let tempDir: string;
  let consoleSpy: ReturnType<typeof rs.spyOn>;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `astro-assets-hook-test-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });
    consoleSpy = rs.spyOn(console, 'warn').mockImplementation(() => {
      // noop
    });

    buildAssetsMapMock.mockImplementation((assets: Record<string, any>) => {
      const result: Record<string, unknown> = {};
      Object.keys(assets).forEach((key, index) => {
        const hash = `hash${index + 1}`;
        result[hash] = {
          hash,
          content: assets[key].content,
          type: assets[key].type,
          filepath: key,
        };
      });
      return result;
    });
  });

  afterEach(async () => {
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
    consoleSpy.mockRestore();
    rs.clearAllMocks();
  });

  describe('Assets Parameter Handling', () => {
    it('should handle assets as a plain object with file paths', async () => {
      await writeFile(
        join(tempDir, 'index.html'),
        '<html><body>Hello</body></html>'
      );
      await writeFile(join(tempDir, 'style.css'), 'body { color: red; }');

      const assets = {
        'index.html': join(tempDir, 'index.html'),
        'style.css': join(tempDir, 'style.css'),
      };

      await extractAstroAssetsFromBuildHook(assets, tempDir);

      expect(buildAssetsMapMock).toHaveBeenCalledWith(
        expect.objectContaining({
          'index.html': expect.objectContaining({
            content: expect.any(Buffer),
            type: 'text/html',
          }),
          'style.css': expect.objectContaining({
            content: expect.any(Buffer),
            type: 'text/css',
          }),
        }),
        expect.any(Function),
        expect.any(Function)
      );
    });

    it('should handle assets as a Map', async () => {
      await writeFile(join(tempDir, 'script.js'), 'console.log("hello");');

      const assets = new Map([['script.js', join(tempDir, 'script.js')]]);

      const result = await extractAstroAssetsFromBuildHook(assets, tempDir);

      expect(result).toBeDefined();
      expect(buildAssetsMapMock).toHaveBeenCalledWith(
        expect.objectContaining({
          'script.js': expect.objectContaining({
            type: 'application/javascript',
          }),
        }),
        expect.any(Function),
        expect.any(Function)
      );
    });

    it('should handle assets as an array of strings', async () => {
      await writeFile(join(tempDir, 'data.json'), '{"key": "value"}');

      const assets = [join(tempDir, 'data.json')];

      await extractAstroAssetsFromBuildHook(assets, tempDir);

      expect(buildAssetsMapMock).toHaveBeenCalledWith(
        expect.objectContaining({
          'data.json': expect.objectContaining({
            type: 'application/json',
          }),
        }),
        expect.any(Function),
        expect.any(Function)
      );
    });

    it('should handle assets as an array of objects with path properties', async () => {
      await writeFile(join(tempDir, 'image.png'), 'PNG data');

      const assets = [{ path: join(tempDir, 'image.png'), size: 1024 }];

      await extractAstroAssetsFromBuildHook(assets, tempDir);

      expect(buildAssetsMapMock).toHaveBeenCalledWith(
        expect.objectContaining({
          'image.png': expect.objectContaining({
            type: 'image/png',
          }),
        }),
        expect.any(Function),
        expect.any(Function)
      );
    });

    it('should handle URL objects', async () => {
      await writeFile(join(tempDir, 'favicon.ico'), 'ICO data');

      const assets = {
        'favicon.ico': new URL(`file://${join(tempDir, 'favicon.ico')}`),
      };

      await extractAstroAssetsFromBuildHook(assets, tempDir);

      expect(buildAssetsMapMock).toHaveBeenCalledWith(
        expect.objectContaining({
          'favicon.ico': expect.objectContaining({
            type: 'image/x-icon',
          }),
        }),
        expect.any(Function),
        expect.any(Function)
      );
    });
  });

  describe('File Filtering', () => {
    it('should skip files that match skip patterns', async () => {
      await writeFile(join(tempDir, 'index.html'), '<html></html>');
      await writeFile(join(tempDir, 'style.css.map'), '{"version":3}');

      const assets = {
        'index.html': join(tempDir, 'index.html'),
        'style.css.map': join(tempDir, 'style.css.map'),
      };

      await extractAstroAssetsFromBuildHook(assets, tempDir);

      expect(buildAssetsMapMock).toHaveBeenCalledWith(
        expect.objectContaining({
          'index.html': expect.any(Object),
        }),
        expect.any(Function),
        expect.any(Function)
      );

      expect(buildAssetsMapMock).toHaveBeenCalledWith(
        expect.not.objectContaining({
          'style.css.map': expect.any(Object),
        }),
        expect.any(Function),
        expect.any(Function)
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle complex nested asset structures', async () => {
      await writeFile(join(tempDir, 'complex.json'), '{"nested": "data"}');

      const assets = {
        route1: [
          join(tempDir, 'complex.json'),
          { path: join(tempDir, 'complex.json') },
        ],
        route2: {
          url: join(tempDir, 'complex.json'),
        },
      };

      await extractAstroAssetsFromBuildHook(assets, tempDir);

      expect(buildAssetsMapMock).toHaveBeenCalledWith(
        expect.objectContaining({
          'complex.json': expect.any(Object),
        }),
        expect.any(Function),
        expect.any(Function)
      );
    });
  });

  describe('Path Resolution', () => {
    it('should handle relative paths correctly', async () => {
      await writeFile(join(tempDir, 'relative.css'), 'body {}');

      const assets = {
        'relative.css': 'relative.css',
      };

      await extractAstroAssetsFromBuildHook(assets, tempDir);

      expect(buildAssetsMapMock).toHaveBeenCalledWith(
        expect.objectContaining({
          'relative.css': expect.objectContaining({
            type: 'text/css',
          }),
        }),
        expect.any(Function),
        expect.any(Function)
      );
    });

    it('should handle absolute paths correctly', async () => {
      await writeFile(join(tempDir, 'absolute.js'), 'console.log()');

      const assets = {
        'absolute.js': join(tempDir, 'absolute.js'),
      };

      await extractAstroAssetsFromBuildHook(assets, tempDir);

      expect(buildAssetsMapMock).toHaveBeenCalledWith(
        expect.objectContaining({
          'absolute.js': expect.objectContaining({
            type: 'application/javascript',
          }),
        }),
        expect.any(Function),
        expect.any(Function)
      );
    });
  });
});
