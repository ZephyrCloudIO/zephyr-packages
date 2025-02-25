import { bench, describe } from 'vitest';
import { ZeWebpackPlugin } from '../../libs/zephyr-webpack-plugin/src/webpack-plugin/ze-webpack-plugin';
import { withZephyr } from '../../libs/zephyr-webpack-plugin/src/webpack-plugin/with-zephyr';

// Create mock assets for testing processAssets method
const createMockAssets = (count = 10) => {
  return Array.from({ length: count }, (_, i) => ({
    name: () => `asset-${i}.js`,
    source: () => `console.log("Asset ${i}");`,
    size: () => 1000 + i * 100,
    map:
      i % 2 === 0
        ? {
            name: () => `asset-${i}.js.map`,
            source: () => '{"version":3,"sources":[],"names":[],"mappings":""}',
            size: () => 500 + i * 50,
          }
        : null,
  }));
};

// Create a mock compilation object
const createMockCompilation = (assetCount = 10) => {
  const assets = {};
  const mockAssets = createMockAssets(assetCount);

  mockAssets.forEach((asset) => {
    const name = asset.name();
    assets[name] = asset;
  });

  return {
    assets,
    outputOptions: {
      publicPath: '/',
    },
    getPath: (p) => p.replace('[name]', 'bundle'),
    compiler: {
      outputPath: '/dist',
    },
  };
};

describe('ZeWebpackPlugin Performance', () => {
  bench('Constructor initialization', () => {
    const zephyrEngine = { buildProperties: {} };
    new ZeWebpackPlugin({
      zephyr_engine: zephyrEngine,
      mfConfig: undefined,
    });
  });

  bench('Plugin apply method', () => {
    const zephyrEngine = { buildProperties: {} };
    const plugin = new ZeWebpackPlugin({
      zephyr_engine: zephyrEngine,
      mfConfig: undefined,
    });

    const mockCompiler = {
      hooks: {
        beforeCompile: { tap: () => {}, tapAsync: () => {} },
        thisCompilation: { tap: () => {} },
        failed: { tap: () => {} },
      },
      outputPath: '/mock/output/path',
    };

    plugin.apply(mockCompiler);
  });

  bench('Process 10 assets', () => {
    const zephyrEngine = {
      buildProperties: {},
      upload_assets: () => Promise.resolve(),
    };
    const plugin = new ZeWebpackPlugin({
      zephyr_engine: zephyrEngine,
      mfConfig: undefined,
    });

    const mockCompilation = createMockCompilation(10);
    // Just run the synchronous part of the method
    plugin.processAssets(mockCompilation);
  });

  bench('Process 100 assets', () => {
    const zephyrEngine = {
      buildProperties: {},
      upload_assets: () => Promise.resolve(),
    };
    const plugin = new ZeWebpackPlugin({
      zephyr_engine: zephyrEngine,
      mfConfig: undefined,
    });

    const mockCompilation = createMockCompilation(100);
    // Just run the synchronous part of the method
    plugin.processAssets(mockCompilation);
  });
});

describe('withZephyr Performance', () => {
  // Testing just the function call, not the async operation
  bench('Function call', () => {
    withZephyr();
  });

  bench('Function with options', () => {
    withZephyr({ wait_for_index_html: true });
  });
});
