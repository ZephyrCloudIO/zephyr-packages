import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildAssetsMap } from 'zephyr-agent';
import { extractAstroAssetsFromBuildHook } from '../extract-astro-assets-map';

// Mock the zephyr-agent buildAssetsMap function
jest.mock('zephyr-agent', () => ({
  buildAssetsMap: jest.fn(),
  logFn: jest.fn(),
}));

// This test focuses on the assets parameter parsing logic
// Fallback behavior is tested in the integration tests

describe('extractAstroAssetsFromBuildHook', () => {
  let tempDir: string;
  let consoleSpy: jest.SpyInstance;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `astro-assets-hook-test-${Date.now()}`);
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

    // No need to mock fallback for core functionality tests
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

  describe('Assets Parameter Handling', () => {
    it('should handle assets as a plain object with file paths', async () => {
      // Create test files
      await writeFile(join(tempDir, 'index.html'), '<html><body>Hello</body></html>');
      await writeFile(join(tempDir, 'style.css'), 'body { color: red; }');

      const assets = {
        'index.html': join(tempDir, 'index.html'),
        'style.css': join(tempDir, 'style.css'),
      };

      await extractAstroAssetsFromBuildHook(assets, tempDir);

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
        }),
        expect.any(Function),
        expect.any(Function)
      );
    });

    it('should handle assets as a Map', async () => {
      // Create test files
      await writeFile(join(tempDir, 'script.js'), 'console.log("hello");');

      const assets = new Map([['script.js', join(tempDir, 'script.js')]]);

      const result = await extractAstroAssetsFromBuildHook(assets, tempDir);

      expect(result).toBeDefined();
      expect(buildAssetsMap).toHaveBeenCalledWith(
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
      // Create test files
      await writeFile(join(tempDir, 'data.json'), '{"key": "value"}');

      const assets = [join(tempDir, 'data.json')];

      await extractAstroAssetsFromBuildHook(assets, tempDir);

      expect(buildAssetsMap).toHaveBeenCalledWith(
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
      // Create test files
      await writeFile(join(tempDir, 'image.png'), 'PNG data');

      const assets = [{ path: join(tempDir, 'image.png'), size: 1024 }];

      await extractAstroAssetsFromBuildHook(assets, tempDir);

      expect(buildAssetsMap).toHaveBeenCalledWith(
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
      // Create test file
      await writeFile(join(tempDir, 'favicon.ico'), 'ICO data');

      const assets = {
        'favicon.ico': new URL(`file://${join(tempDir, 'favicon.ico')}`),
      };

      await extractAstroAssetsFromBuildHook(assets, tempDir);

      expect(buildAssetsMap).toHaveBeenCalledWith(
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

  // Fallback behavior is tested in integration tests to avoid mocking complexity

  describe('File Filtering', () => {
    it('should skip files that match skip patterns', async () => {
      // Create test files including ones that should be skipped
      await writeFile(join(tempDir, 'index.html'), '<html></html>');
      await writeFile(join(tempDir, 'style.css.map'), '{"version":3}');

      const assets = {
        'index.html': join(tempDir, 'index.html'),
        'style.css.map': join(tempDir, 'style.css.map'),
      };

      await extractAstroAssetsFromBuildHook(assets, tempDir);

      expect(buildAssetsMap).toHaveBeenCalledWith(
        expect.objectContaining({
          'index.html': expect.any(Object),
        }),
        expect.any(Function),
        expect.any(Function)
      );

      // Should not include the .map file
      expect(buildAssetsMap).toHaveBeenCalledWith(
        expect.not.objectContaining({
          'style.css.map': expect.any(Object),
        }),
        expect.any(Function),
        expect.any(Function)
      );
    });
  });

  describe('Error Handling', () => {
    // File read error handling and fallback behavior is tested in integration tests

    it('should handle complex nested asset structures', async () => {
      // Create test file
      await writeFile(join(tempDir, 'complex.json'), '{"nested": "data"}');

      const assets = {
        route1: [join(tempDir, 'complex.json'), { path: join(tempDir, 'complex.json') }],
        route2: {
          url: join(tempDir, 'complex.json'),
        },
      };

      await extractAstroAssetsFromBuildHook(assets, tempDir);

      expect(buildAssetsMap).toHaveBeenCalledWith(
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
      // Create test file
      await writeFile(join(tempDir, 'relative.css'), 'body {}');

      const assets = {
        'relative.css': 'relative.css', // Relative path
      };

      await extractAstroAssetsFromBuildHook(assets, tempDir);

      expect(buildAssetsMap).toHaveBeenCalledWith(
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
      // Create test file
      await writeFile(join(tempDir, 'absolute.js'), 'console.log()');

      const assets = {
        'absolute.js': join(tempDir, 'absolute.js'), // Absolute path
      };

      await extractAstroAssetsFromBuildHook(assets, tempDir);

      expect(buildAssetsMap).toHaveBeenCalledWith(
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
