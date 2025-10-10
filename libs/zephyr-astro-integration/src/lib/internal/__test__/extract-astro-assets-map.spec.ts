import { extractAstroAssetsMap } from '../extract-astro-assets-map';
import { buildAssetsMap } from 'zephyr-agent';
import { mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Mock the zephyr-agent buildAssetsMap function
jest.mock('zephyr-agent', () => ({
  buildAssetsMap: jest.fn(),
}));

describe('extractAstroAssetsMap', () => {
  let tempDir: string;
  let consoleSpy: jest.SpyInstance;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `astro-test-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });
    consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {
      // Mock implementation
    });

    // Mock buildAssetsMap to return a simple hash-based result
    (buildAssetsMap as jest.Mock).mockImplementation((assets) => {
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
    if (consoleSpy && typeof consoleSpy.mockRestore === 'function') {
      consoleSpy.mockRestore();
    }
    jest.clearAllMocks();
  });

  describe('Basic Asset Extraction', () => {
    it('should extract assets from build directory', async () => {
      // Create test files
      await writeFile(join(tempDir, 'index.html'), '<html><body>Hello</body></html>');
      await writeFile(join(tempDir, 'style.css'), 'body { color: red; }');
      await writeFile(join(tempDir, 'script.js'), 'console.log("hello");');

      const assetsMap = await extractAstroAssetsMap(tempDir);

      expect(Object.keys(assetsMap)).toHaveLength(3);
      expect(buildAssetsMap).toHaveBeenCalledWith(
        expect.objectContaining({
          'index.html': expect.objectContaining({
            content: expect.any(Buffer),
            type: 'text/html',
          }),
          'style.css': expect.objectContaining({
            content: expect.any(Buffer),
            type: 'text/css',
          }),
          'script.js': expect.objectContaining({
            content: expect.any(Buffer),
            type: 'application/javascript',
          }),
        }),
        expect.any(Function),
        expect.any(Function)
      );
    });

    it('should handle empty directory', async () => {
      const assetsMap = await extractAstroAssetsMap(tempDir);
      expect(Object.keys(assetsMap)).toHaveLength(0);
      expect(buildAssetsMap).toHaveBeenCalledWith(
        {},
        expect.any(Function),
        expect.any(Function)
      );
    });
  });

  describe('File Filtering', () => {
    it('should skip source maps', async () => {
      await writeFile(join(tempDir, 'index.html'), '<html></html>');
      await writeFile(join(tempDir, 'style.css.map'), '{"version":3}');
      await writeFile(join(tempDir, 'script.js.map'), '{"version":3}');

      const result = await extractAstroAssetsMap(tempDir);

      expect(result).toBeDefined();
      expect(buildAssetsMap).toHaveBeenCalledWith(
        expect.objectContaining({
          'index.html': expect.any(Object),
        }),
        expect.any(Function),
        expect.any(Function)
      );
      expect(buildAssetsMap).not.toHaveBeenCalledWith(
        expect.objectContaining({
          'style.css.map': expect.any(Object),
          'script.js.map': expect.any(Object),
        }),
        expect.any(Function),
        expect.any(Function)
      );
    });

    it('should skip system files', async () => {
      await writeFile(join(tempDir, 'index.html'), '<html></html>');
      await writeFile(join(tempDir, '.DS_Store'), 'system data');
      await writeFile(join(tempDir, 'Thumbs.db'), 'windows thumbnail');

      const result = await extractAstroAssetsMap(tempDir);

      expect(result).toBeDefined();
      expect(buildAssetsMap).toHaveBeenCalledWith(
        expect.objectContaining({
          'index.html': expect.any(Object),
        }),
        expect.any(Function),
        expect.any(Function)
      );
    });

    it('should skip node_modules and git directories', async () => {
      await mkdir(join(tempDir, 'node_modules'), { recursive: true });
      await mkdir(join(tempDir, '.git'), { recursive: true });
      await writeFile(join(tempDir, 'node_modules', 'package.json'), '{}');
      await writeFile(join(tempDir, '.git', 'config'), 'git config');
      await writeFile(join(tempDir, 'index.html'), '<html></html>');

      const result = await extractAstroAssetsMap(tempDir);

      expect(result).toBeDefined();
      expect(buildAssetsMap).toHaveBeenCalledWith(
        expect.objectContaining({
          'index.html': expect.any(Object),
        }),
        expect.any(Function),
        expect.any(Function)
      );
    });
  });

  describe('File Type Detection', () => {
    it('should correctly identify file types', async () => {
      const testFiles = [
        ['index.html', '<html></html>', 'text/html'],
        ['style.css', 'body {}', 'text/css'],
        ['script.js', 'console.log()', 'application/javascript'],
        ['module.mjs', 'export default {}', 'application/javascript'],
        ['data.json', '{}', 'application/json'],
        ['image.png', Buffer.from('PNG data'), 'image/png'],
        ['image.jpg', Buffer.from('JPG data'), 'image/jpeg'],
        ['image.svg', '<svg></svg>', 'image/svg+xml'],
        ['favicon.ico', Buffer.from('ICO data'), 'image/x-icon'],
        ['font.woff', Buffer.from('WOFF data'), 'font/woff'],
        ['font.woff2', Buffer.from('WOFF2 data'), 'font/woff2'],
        ['unknown.xyz', 'unknown content', 'application/octet-stream'],
      ];

      for (const [filename, content] of testFiles) {
        await writeFile(join(tempDir, filename), content);
      }

      await extractAstroAssetsMap(tempDir);

      const buildAssetsMapCall = (buildAssetsMap as jest.Mock).mock.calls[0];
      const assets = buildAssetsMapCall[0];

      testFiles.forEach(([filename, , expectedType]) => {
        expect(assets[filename]).toHaveProperty('type', expectedType);
      });
    });
  });

  describe('Directory Traversal', () => {
    it('should handle nested directories', async () => {
      await mkdir(join(tempDir, 'assets', 'js'), { recursive: true });
      await mkdir(join(tempDir, 'assets', 'css'), { recursive: true });
      await mkdir(join(tempDir, 'images'), { recursive: true });

      await writeFile(join(tempDir, 'index.html'), '<html></html>');
      await writeFile(join(tempDir, 'assets', 'js', 'main.js'), 'console.log()');
      await writeFile(join(tempDir, 'assets', 'css', 'style.css'), 'body {}');
      await writeFile(join(tempDir, 'images', 'logo.png'), 'PNG data');

      const result = await extractAstroAssetsMap(tempDir);

      expect(result).toBeDefined();
      expect(buildAssetsMap).toHaveBeenCalledWith(
        expect.objectContaining({
          'index.html': expect.any(Object),
          'assets/js/main.js': expect.any(Object),
          'assets/css/style.css': expect.any(Object),
          'images/logo.png': expect.any(Object),
        }),
        expect.any(Function),
        expect.any(Function)
      );
    });

    it('should handle deeply nested directories', async () => {
      const deepPath = join(tempDir, 'a', 'b', 'c', 'd', 'e');
      await mkdir(deepPath, { recursive: true });
      await writeFile(join(deepPath, 'deep.txt'), 'deep file');

      const result = await extractAstroAssetsMap(tempDir);

      expect(result).toBeDefined();
      expect(buildAssetsMap).toHaveBeenCalledWith(
        expect.objectContaining({
          'a/b/c/d/e/deep.txt': expect.objectContaining({
            type: 'text/plain',
          }),
        }),
        expect.any(Function),
        expect.any(Function)
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle file read errors gracefully', async () => {
      await writeFile(join(tempDir, 'good.txt'), 'readable');
      await writeFile(join(tempDir, 'index.html'), '<html></html>');

      // Mock readFile to fail for specific file
      const originalReadFile = readFile;
      jest
        .spyOn(require('node:fs/promises'), 'readFile')
        .mockImplementation(async (path) => {
          if (path.toString().includes('good.txt')) {
            throw new Error('Permission denied');
          }
          return originalReadFile(path);
        });

      const result = await extractAstroAssetsMap(tempDir);

      expect(result).toBeDefined();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/Failed to read file.*good\.txt/),
        expect.any(Error)
      );

      // Should still process the readable file
      expect(buildAssetsMap).toHaveBeenCalledWith(
        expect.objectContaining({
          'index.html': expect.any(Object),
        }),
        expect.any(Function),
        expect.any(Function)
      );

      jest.restoreAllMocks();
    });

    it('should handle directory read errors gracefully', async () => {
      await writeFile(join(tempDir, 'index.html'), '<html></html>');
      await mkdir(join(tempDir, 'subdir'), { recursive: true });

      // Mock readdir to fail for subdirectory
      const originalReaddir = require('node:fs/promises').readdir;
      jest
        .spyOn(require('node:fs/promises'), 'readdir')
        .mockImplementation(async (path, options) => {
          if (path.toString().includes('subdir')) {
            throw new Error('Access denied');
          }
          return originalReaddir(path, options);
        });

      const result = await extractAstroAssetsMap(tempDir);

      expect(result).toBeDefined();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/Failed to walk directory.*subdir/),
        expect.any(Error)
      );

      jest.restoreAllMocks();
    });
  });

  describe('Utility Functions', () => {
    it('should test extractBuffer function', async () => {
      await writeFile(join(tempDir, 'test.txt'), 'test content');
      await extractAstroAssetsMap(tempDir);

      const extractBuffer = (buildAssetsMap as jest.Mock).mock.calls[0][1];
      const testAsset = { content: Buffer.from('test'), type: 'text/plain' };

      expect(extractBuffer(testAsset)).toBe(testAsset.content);
    });

    it('should test getAssetType function', async () => {
      await writeFile(join(tempDir, 'test.txt'), 'test content');
      await extractAstroAssetsMap(tempDir);

      const getAssetType = (buildAssetsMap as jest.Mock).mock.calls[0][2];
      const testAsset = { content: Buffer.from('test'), type: 'text/plain' };

      expect(getAssetType(testAsset)).toBe('text/plain');
    });
  });
});
