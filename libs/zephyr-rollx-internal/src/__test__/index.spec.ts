import * as indexExports from '../index';
import type { XOutputChunk } from '../types';

describe('index', () => {
  it('should export all expected modules from lib directory', () => {
    // Test assets-map exports
    expect(indexExports.getRollxAssetsMap).toBeDefined();
    expect(indexExports.extractRollxBuffer).toBeDefined();
    expect(indexExports.getRollxAssetType).toBeDefined();
    expect(typeof indexExports.getRollxAssetsMap).toBe('function');
    expect(typeof indexExports.extractRollxBuffer).toBe('function');
    expect(typeof indexExports.getRollxAssetType).toBe('function');
  });

  it('should export all expected modules from extract-build-stats', () => {
    // Test extract-build-stats exports
    expect(indexExports.extractRollxBuildStats).toBeDefined();
    expect(typeof indexExports.extractRollxBuildStats).toBe('function');
  });

  it('should export all expected modules from remote-regex', () => {
    // Test remote-regex exports
    expect(indexExports.viteLikeRemoteRegex).toBeDefined();
    expect(Array.isArray(indexExports.viteLikeRemoteRegex)).toBe(true);
    expect(indexExports.viteLikeRemoteRegex.length).toBeGreaterThan(0);

    // Verify all items in the array are RegExp objects
    indexExports.viteLikeRemoteRegex.forEach((regex) => {
      expect(regex).toBeInstanceOf(RegExp);
      expect(regex.global).toBe(true);
    });
  });

  it('should export all types from types/index', () => {
    // Since types are compile-time only, we can't directly test their export
    // But we can verify the module structure is correct by checking the export names
    const exportNames = Object.keys(indexExports);

    // Verify we have the expected function exports
    expect(exportNames).toEqual(
      expect.arrayContaining([
        'getRollxAssetsMap',
        'extractRollxBuffer',
        'getRollxAssetType',
        'extractRollxBuildStats',
        'viteLikeRemoteRegex',
      ])
    );
  });

  it('should maintain module re-export structure', () => {
    // Test that the re-exports work correctly by calling a function
    const mockBundle = {
      'test.js': {
        type: 'chunk' as const,
        code: 'console.log("test");',
        fileName: 'test.js',
        name: 'test',
        moduleIds: ['src/test.js'],
        isEntry: true,
        exports: [],
        imports: [],
      },
    };

    // This should work without throwing if exports are properly re-exported
    expect(() => {
      const result = indexExports.getRollxAssetsMap(mockBundle);
      expect(result).toBeDefined();
    }).not.toThrow();
  });

  it('should export functions that can be used independently', () => {
    // Test extractRollxBuffer function
    const testChunk = {
      type: 'chunk' as const,
      code: 'test code content',
    };

    const buffer = indexExports.extractRollxBuffer(testChunk as XOutputChunk);
    expect(buffer).toBe('test code content');

    // Test getRollxAssetType function
    const assetType = indexExports.getRollxAssetType(testChunk as XOutputChunk);
    expect(assetType).toBe('chunk');
  });

  it('should export regex patterns that work correctly', () => {
    const testCode = 'loadRemote("remote1/Component1")';
    const pattern = indexExports.viteLikeRemoteRegex[0];

    const matches = [...testCode.matchAll(pattern)];
    expect(matches).toHaveLength(1);
    expect(matches[0][1]).toBe('remote1');
    expect(matches[0][2]).toBe('Component1');
  });

  it('should not export any unexpected properties', () => {
    const exportNames = Object.keys(indexExports);

    const expectedExports = [
      'getRollxAssetsMap',
      'extractRollxBuffer',
      'getRollxAssetType',
      'extractRollxBuildStats',
      'viteLikeRemoteRegex',
      'getPackageDependencies',
      'extractModulesFromExposes',
      'load_static_entries',
      'parseSharedDependencies',
    ];

    // Check that we only export what we expect (no extra exports)
    exportNames.forEach((exportName) => {
      expect(expectedExports).toContain(exportName);
    });

    // Check that we export everything we expect (no missing exports)
    expectedExports.forEach((expectedExport) => {
      expect(exportNames).toContain(expectedExport);
    });
  });

  it('should maintain consistent export types', () => {
    // Verify export types are consistent with expectations
    expect(typeof indexExports.getRollxAssetsMap).toBe('function');
    expect(typeof indexExports.extractRollxBuffer).toBe('function');
    expect(typeof indexExports.getRollxAssetType).toBe('function');
    expect(typeof indexExports.extractRollxBuildStats).toBe('function');
    expect(Array.isArray(indexExports.viteLikeRemoteRegex)).toBe(true);
  });
});
