import { bench, describe } from 'vitest';
import { ZeRepackPlugin } from '../../libs/zephyr-repack-plugin/src/lib/ze-repack-plugin';
import { withZephyr } from '../../libs/zephyr-repack-plugin/src/lib/with-zephyr';

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

describe('ZeRepackPlugin Performance', () => {
  bench('Constructor initialization (iOS)', () => {
    const zephyrEngine = { buildProperties: {} };
    new ZeRepackPlugin({
      zephyr_engine: zephyrEngine,
      mfConfig: undefined,
      target: 'ios',
    });
  });

  bench('Constructor initialization (Android)', () => {
    const zephyrEngine = { buildProperties: {} };
    new ZeRepackPlugin({
      zephyr_engine: zephyrEngine,
      mfConfig: undefined,
      target: 'android',
    });
  });

  bench('Plugin apply method', () => {
    const zephyrEngine = { buildProperties: {} };
    const plugin = new ZeRepackPlugin({
      zephyr_engine: zephyrEngine,
      mfConfig: undefined,
      target: 'ios',
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

  // The ZeRepackPlugin uses a different approach to process assets through setupZeDeploy
  // so we skip these benchmarks as they're not directly comparable to other plugins

  bench('Process 10 assets (iOS) - mock implementation', () => {
    const zephyrEngine = {
      buildProperties: {},
      upload_assets: () => Promise.resolve(),
    };
    const plugin = new ZeRepackPlugin({
      zephyr_engine: zephyrEngine,
      mfConfig: undefined,
      target: 'ios',
    });

    // Just simulate some asset processing
    const mockCompilation = createMockCompilation(10);
    Object.values(mockCompilation.assets).forEach((asset) => {
      const source = asset.source();
      const size = asset.size();
    });
  });

  bench('Process 100 assets (Android) - mock implementation', () => {
    const zephyrEngine = {
      buildProperties: {},
      upload_assets: () => Promise.resolve(),
    };
    const plugin = new ZeRepackPlugin({
      zephyr_engine: zephyrEngine,
      mfConfig: undefined,
      target: 'android',
    });

    // Just simulate some asset processing
    const mockCompilation = createMockCompilation(100);
    Object.values(mockCompilation.assets).forEach((asset) => {
      const source = asset.source();
      const size = asset.size();
    });
  });
});

describe('withZephyr Performance', () => {
  bench('Function call with ios target', () => {
    withZephyr('ios');
  });

  bench('Function call with android target', () => {
    withZephyr('android');
  });

  bench('With options', () => {
    withZephyr('ios', { wait_for_index_html: true });
  });
});
