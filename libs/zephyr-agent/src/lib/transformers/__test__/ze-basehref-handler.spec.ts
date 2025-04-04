import { normalizeBasePath, applyBaseHrefToAssets } from '../ze-basehref-handler';
import { ZeBuildAssetsMap } from 'zephyr-edge-contract';

describe('ze-basehref-handler', () => {
  describe('normalizeBasePath', () => {
    it('should return empty string for null or undefined', () => {
      expect(normalizeBasePath(null)).toBe('');
      expect(normalizeBasePath(undefined)).toBe('');
    });

    it('should return empty string for empty string input', () => {
      expect(normalizeBasePath('')).toBe('');
    });

    it('should return empty string for root paths', () => {
      expect(normalizeBasePath('/')).toBe('');
      expect(normalizeBasePath('./')).toBe('');
      expect(normalizeBasePath('.')).toBe('');
    });

    it('should remove leading and trailing slashes', () => {
      expect(normalizeBasePath('/path/')).toBe('path');
      expect(normalizeBasePath('/path')).toBe('path');
      expect(normalizeBasePath('path/')).toBe('path');
    });

    it('should remove leading ./ if present', () => {
      expect(normalizeBasePath('./path')).toBe('path');
      expect(normalizeBasePath('./path/')).toBe('path');
    });

    it('should handle nested paths correctly', () => {
      expect(normalizeBasePath('/nested/path/')).toBe('nested/path');
      expect(normalizeBasePath('./nested/path/')).toBe('nested/path');
      expect(normalizeBasePath('nested/path')).toBe('nested/path');
    });

    it('should trim whitespace', () => {
      expect(normalizeBasePath('  path  ')).toBe('path');
      expect(normalizeBasePath('  /path/  ')).toBe('path');
    });

    it('should handle combined cases correctly', () => {
      expect(normalizeBasePath('  ./nested/path/  ')).toBe('nested/path');
      expect(normalizeBasePath('/  nested/path  /')).toBe('nested/path');
    });
  });

  describe('applyBaseHrefToAssets', () => {
    // Define a sample assets map for testing
    const sampleAssetsMap: ZeBuildAssetsMap = {
      'main.js': {
        path: 'main.js',
        extname: '.js',
        hash: 'hash123',
        size: 1000,
        buffer: Buffer.from('content'),
      },
      'index.html': {
        path: 'index.html',
        extname: '.html',
        hash: 'hash456',
        size: 500,
        buffer: Buffer.from('content'),
      },
      'styles.css': {
        path: 'styles.css',
        extname: '.css',
        hash: 'hash789',
        size: 200,
        buffer: Buffer.from('content'),
      },
      'absolute.js': {
        path: '/absolute/path/to/file.js',
        extname: '.js',
        hash: 'hash101',
        size: 300,
        buffer: Buffer.from('content'),
      },
      'external.js': {
        path: 'https://cdn.example.com/script.js',
        extname: '.js',
        hash: 'hash202',
        size: 400,
        buffer: Buffer.from('content'),
      },
      'nested/image.png': {
        path: 'nested/image.png',
        extname: '.png',
        hash: 'hash303',
        size: 2000,
        buffer: Buffer.from('content'),
      },
    };

    it('should return the original map when baseHref is null, undefined, or empty', () => {
      expect(applyBaseHrefToAssets(sampleAssetsMap, null)).toBe(sampleAssetsMap);
      expect(applyBaseHrefToAssets(sampleAssetsMap, undefined)).toBe(sampleAssetsMap);
      expect(applyBaseHrefToAssets(sampleAssetsMap, '')).toBe(sampleAssetsMap);
      expect(applyBaseHrefToAssets(sampleAssetsMap, '/')).toBe(sampleAssetsMap);
      expect(applyBaseHrefToAssets(sampleAssetsMap, './')).toBe(sampleAssetsMap);
      expect(applyBaseHrefToAssets(sampleAssetsMap, '.')).toBe(sampleAssetsMap);
    });

    it('should apply baseHref to relative paths, keeping the same keys', () => {
      const result = applyBaseHrefToAssets(sampleAssetsMap, 'base');

      // Should have the same keys
      expect(Object.keys(result)).toEqual(Object.keys(sampleAssetsMap));

      // Regular assets should have baseHref applied
      expect(result['main.js'].path).toBe('base/main.js');
      expect(result['styles.css'].path).toBe('base/styles.css');
      expect(result['nested/image.png'].path).toBe('base/nested/image.png');

      // index.html should remain unchanged
      expect(result['index.html'].path).toBe('index.html');

      // Absolute paths should remain unchanged
      expect(result['absolute.js'].path).toBe('/absolute/path/to/file.js');
      expect(result['external.js'].path).toBe('https://cdn.example.com/script.js');
    });

    it('should normalize the baseHref before applying it', () => {
      const result = applyBaseHrefToAssets(sampleAssetsMap, '/base/');

      // Regular assets should have normalized baseHref applied
      expect(result['main.js'].path).toBe('base/main.js');
      expect(result['styles.css'].path).toBe('base/styles.css');
    });

    it('should handle nested baseHref paths correctly', () => {
      const result = applyBaseHrefToAssets(sampleAssetsMap, 'nested/base');

      // Should properly join the paths
      expect(result['main.js'].path).toBe('nested/base/main.js');
      expect(result['styles.css'].path).toBe('nested/base/styles.css');
    });

    it('should create a new map without modifying the original', () => {
      const original = { ...sampleAssetsMap };
      const result = applyBaseHrefToAssets(sampleAssetsMap, 'base');

      // Original should not be modified
      expect(sampleAssetsMap).toEqual(original);

      // Result should be a new object
      expect(result).not.toBe(sampleAssetsMap);
    });

    it('should create a deep copy of assets', () => {
      const result = applyBaseHrefToAssets(sampleAssetsMap, 'base');

      // Each asset in the result should be a new object
      Object.keys(result).forEach((key) => {
        expect(result[key]).not.toBe(sampleAssetsMap[key]);
      });
    });
  });
});
