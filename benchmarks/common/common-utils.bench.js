import { bench, describe } from 'vitest';

// Mock the ZephyrEngine
const mockZephyrEngine = {
  defer_create: () => {
    const mockEngine = {
      buildProperties: {},
      start_new_build: () => Promise.resolve(),
      upload_assets: () => Promise.resolve(),
      build_finished: () => Promise.resolve(),
    };

    return {
      zephyr_engine_defer: Promise.resolve(mockEngine),
      zephyr_defer_create: () => {},
    };
  },
};

// Create mock assets array
const createMockAssets = (count = 10) => {
  return Array.from({ length: count }, (_, i) => ({
    name: `asset-${i}.js`,
    content: `console.log("Asset ${i}");`,
    size: 1000 + i * 100,
    sourcemap:
      i % 2 === 0
        ? {
            name: `asset-${i}.js.map`,
            content: '{"version":3,"sources":[],"names":[],"mappings":""}',
            size: 500 + i * 50,
          }
        : null,
  }));
};

describe('Common Utilities Performance', () => {
  // Test ZephyrEngine creation performance
  bench('ZephyrEngine initialization (synchronous part)', () => {
    // Just test the synchronous part, not the async initialization
    mockZephyrEngine.defer_create();
  });

  // Test deferred promise handling
  bench('ZephyrEngine deferred promise creation', () => {
    const { zephyr_engine_defer, zephyr_defer_create } = mockZephyrEngine.defer_create();
    // Access the deferred promise to ensure it's initialized
    zephyr_defer_create({
      builder: 'test',
      context: '/sample/context',
    });
  });

  // Test asset processing - important for benchmarking our refactored code
  bench('Process 10 assets with half having sourcemaps', () => {
    const assets = createMockAssets(10);
    const processedAssets = assets.map((asset) => {
      // Basic asset processing similar to what plugins do
      const result = {
        fileName: asset.name,
        source: asset.content,
        size: asset.size,
      };

      if (asset.sourcemap) {
        result.map = {
          fileName: asset.sourcemap.name,
          source: asset.sourcemap.content,
          size: asset.sourcemap.size,
        };
      }

      return result;
    });

    return processedAssets;
  });

  bench('Process 100 assets with half having sourcemaps', () => {
    const assets = createMockAssets(100);
    const processedAssets = assets.map((asset) => {
      // Basic asset processing similar to what plugins do
      const result = {
        fileName: asset.name,
        source: asset.content,
        size: asset.size,
      };

      if (asset.sourcemap) {
        result.map = {
          fileName: asset.sourcemap.name,
          source: asset.sourcemap.content,
          size: asset.sourcemap.size,
        };
      }

      return result;
    });

    return processedAssets;
  });
});
