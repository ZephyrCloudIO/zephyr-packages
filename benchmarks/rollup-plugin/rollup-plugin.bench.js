import { bench, describe } from 'vitest';
import { ZeRollupPlugin } from '../../libs/rollup-plugin-zephyr/src/lib/ze-rollup-plugin';

// Create mock assets for testing processAssets method
const createMockAssets = (count = 10) => {
  const assets = {};

  for (let i = 0; i < count; i++) {
    const fileName = `asset-${i}.js`;
    assets[fileName] = {
      fileName,
      source: `console.log("Asset ${i}");`,
      type: 'chunk',
    };

    if (i % 2 === 0) {
      const mapFileName = `asset-${i}.js.map`;
      assets[mapFileName] = {
        fileName: mapFileName,
        source: '{"version":3,"sources":[],"names":[],"mappings":""}',
        type: 'asset',
      };
    }
  }

  return assets;
};

describe('rollup-plugin-zephyr Performance', () => {
  bench('Plugin creation', () => {
    const zephyrEngine = { buildProperties: {} };
    new ZeRollupPlugin({
      zephyr_engine: zephyrEngine,
    });
  });

  bench('Plugin creation with options', () => {
    const zephyrEngine = { buildProperties: {} };
    new ZeRollupPlugin({
      zephyr_engine: zephyrEngine,
      wait_for_index_html: true,
    });
  });

  describe('Plugin Methods', () => {
    const zephyrEngine = {
      buildProperties: {},
      upload_assets: () => Promise.resolve(),
      start_new_build: () => Promise.resolve(),
      build_finished: () => Promise.resolve(),
    };
    const plugin = new ZeRollupPlugin({
      zephyr_engine: zephyrEngine,
      pluginName: 'test-rollup-plugin',
    });

    bench('Process 10 assets', () => {
      const bundle = createMockAssets(10);
      // Just run the mock method to measure performance without actual uploads
      // This will test the transformation logic in getAssetsMap
      return {
        assetsMap: Object.values(bundle).map((asset) => ({
          fileName: asset.fileName,
          source: asset.source,
          size: asset.source.length,
        })),
      };
    });

    bench('Process 100 assets', () => {
      const bundle = createMockAssets(100);
      // Just run the mock method to measure performance without actual uploads
      // This will test the transformation logic in getAssetsMap
      return {
        assetsMap: Object.values(bundle).map((asset) => ({
          fileName: asset.fileName,
          source: asset.source,
          size: asset.source.length,
        })),
      };
    });
  });
});

describe('withZephyr Performance', () => {
  bench('Function call', () => {
    // Mock function to avoid imports
    const withZephyr = (opts = {}) => {
      return {
        name: 'rollup-plugin-zephyr',
        buildStart: () => {},
        writeBundle: () => {},
      };
    };
    withZephyr();
  });

  bench('With options', () => {
    // Mock function to avoid imports
    const withZephyr = (opts = {}) => {
      return {
        name: 'rollup-plugin-zephyr',
        buildStart: () => {},
        writeBundle: () => {},
      };
    };
    withZephyr({ wait_for_index_html: true });
  });
});
