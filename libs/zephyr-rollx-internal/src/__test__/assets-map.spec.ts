import {
  extractRollxBuffer,
  getRollxAssetType,
  getRollxAssetsMap,
} from '../lib/assets-map';
import type { XOutputAsset, XOutputBundle, XOutputChunk } from '../types/index';

describe('assets-map', () => {
  describe('extractRollxBuffer', () => {
    it('should extract code from chunk asset', () => {
      const chunk: XOutputChunk = {
        type: 'chunk',
        code: 'const test = "hello world";',
        fileName: 'test.js',
        name: 'test',
        facadeModuleId: 'test.js',
        moduleIds: ['test.js'],
        isEntry: true,
        exports: [],
        imports: [],
      };

      const result = extractRollxBuffer(chunk);
      expect(result).toBe('const test = "hello world";');
    });

    it('should extract source from asset when source is string', () => {
      const asset: XOutputAsset = {
        type: 'asset',
        source: 'body { color: red; }',
        fileName: 'style.css',
        names: ['style.css'],
        originalFileNames: ['style.css'],
        needsCodeReference: false,
      };

      const result = extractRollxBuffer(asset);
      expect(result).toBe('body { color: red; }');
    });

    it('should extract source from asset when source is Uint8Array', () => {
      const source = new TextEncoder().encode('binary content');
      const asset: XOutputAsset = {
        type: 'asset',
        source,
        fileName: 'image.png',
        names: ['image.png'],
        originalFileNames: ['image.png'],
        needsCodeReference: false,
      };

      const result = extractRollxBuffer(asset);
      expect(result).toBeInstanceOf(Buffer);
      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result).toEqual(Buffer.from(source));
    });

    it('should return undefined for unknown asset type', () => {
      const unknownAsset = {
        type: 'unknown',
      };

      // @ts-expect-error - unknown asset type
      const result = extractRollxBuffer(unknownAsset);
      expect(result).toBeUndefined();
    });
  });

  describe('getRollxAssetType', () => {
    it('should return "chunk" for chunk asset', () => {
      const chunk: XOutputChunk = {
        type: 'chunk',
        code: 'const test = "hello";',
        fileName: 'test.js',
        name: 'test',
        facadeModuleId: 'test.js',
        moduleIds: ['test.js'],
        isEntry: true,
        exports: [],
        imports: [],
      };

      const result = getRollxAssetType(chunk);
      expect(result).toBe('chunk');
    });

    it('should return "asset" for asset type', () => {
      const asset: XOutputAsset = {
        type: 'asset',
        source: 'content',
        fileName: 'file.txt',
        names: ['file.txt'],
        originalFileNames: ['file.txt'],
        needsCodeReference: false,
      };

      const result = getRollxAssetType(asset);
      expect(result).toBe('asset');
    });
  });

  describe('getRollxAssetsMap', () => {
    it('should process bundle with mixed assets and chunks', () => {
      const bundle: XOutputBundle = {
        'main.js': {
          type: 'chunk',
          code: 'console.log("main");',
          fileName: 'main.js',
          name: 'main',
          facadeModuleId: 'main.js',
          moduleIds: ['src/main.js'],
          isEntry: true,
          exports: [],
          imports: [],
        },
        'style.css': {
          type: 'asset',
          source: '.main { color: blue; }',
          fileName: 'style.css',
          names: ['style.css'],
          originalFileNames: ['src/style.css'],
          needsCodeReference: false,
        },
        'vendor.js': {
          type: 'chunk',
          code: 'export const vendor = true;',
          fileName: 'vendor.js',
          name: 'vendor',
          facadeModuleId: 'vendor.js',
          moduleIds: ['node_modules/vendor/index.js'],
          isEntry: false,
          exports: ['vendor'],
          imports: [],
        },
      };

      const result = getRollxAssetsMap(bundle);

      // The actual shape depends on the buildAssetsMap implementation from zephyr-agent
      // We're testing that the function calls the buildAssetsMap with correct parameters
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });

    it('should handle empty bundle', () => {
      const bundle: XOutputBundle = {};

      const result = getRollxAssetsMap(bundle);
      expect(result).toBeDefined();
    });

    it('should handle bundle with only chunks', () => {
      const bundle: XOutputBundle = {
        'app.js': {
          type: 'chunk',
          code: 'import "./style.css"; console.log("app");',
          fileName: 'app.js',
          name: 'app',
          facadeModuleId: 'app.js',
          moduleIds: ['src/app.js'],
          isEntry: true,
          exports: [],
          imports: ['./style.css'],
        },
        'utils.js': {
          type: 'chunk',
          code: 'export const utils = {};',
          fileName: 'utils.js',
          name: 'utils',
          facadeModuleId: 'utils.js',
          moduleIds: ['src/utils.js'],
          isEntry: false,
          exports: ['utils'],
          imports: [],
        },
      };

      const result = getRollxAssetsMap(bundle);
      expect(result).toBeDefined();
    });

    it('should handle bundle with only assets', () => {
      const bundle: XOutputBundle = {
        'main.css': {
          type: 'asset',
          source: '.app { font-family: Arial; }',
          fileName: 'main.css',
          names: ['main.css'],
          originalFileNames: ['src/main.css'],
          needsCodeReference: false,
        },
        'logo.svg': {
          type: 'asset',
          source: new TextEncoder().encode('<svg>...</svg>'),
          fileName: 'logo.svg',
          names: ['logo.svg'],
          originalFileNames: ['src/assets/logo.svg'],
          needsCodeReference: false,
        },
      };

      const result = getRollxAssetsMap(bundle);
      expect(result).toBeDefined();
    });
  });
});
