import { bench, describe } from 'vitest';
import { ZeVitePlugin } from '../../libs/vite-plugin-zephyr/src/lib/vite-plugin-zephyr';

// Create mock assets for testing processAssets method
const createMockAssets = (count = 10) => {
  const assets = [];

  for (let i = 0; i < count; i++) {
    assets.push({
      fileName: `asset-${i}.js`,
      source: `console.log("Asset ${i}");`,
      size: 1000 + i * 100,
      map:
        i % 2 === 0
          ? {
              fileName: `asset-${i}.js.map`,
              source: '{"version":3,"sources":[],"names":[],"mappings":""}',
              size: 500 + i * 50,
            }
          : null,
    });
  }

  return assets;
};

describe('vite-plugin-zephyr Performance', () => {
  bench('Plugin creation', () => {
    const zephyrEngine = { buildProperties: {} };
    new ZeVitePlugin({
      zephyr_engine: zephyrEngine,
      mfConfig: undefined,
    });
  });

  bench('Create with module federation config', () => {
    const zephyrEngine = { buildProperties: {} };
    new ZeVitePlugin({
      zephyr_engine: zephyrEngine,
      mfConfig: { name: 'host', remotes: {} },
    });
  });

  describe('Plugin Methods', () => {
    // Initialize plugin once for all benchmarks
    const zephyrEngine = {
      buildProperties: {},
      upload_assets: () => Promise.resolve(),
    };
    const plugin = new ZeVitePlugin({
      zephyr_engine: zephyrEngine,
      mfConfig: undefined,
    });

    bench('configResolved hook', () => {
      const config = {
        root: '/project/root',
        build: { outDir: 'dist' },
        publicDir: 'public',
      };

      // Just benchmark the hook call itself, not waiting for promises
      plugin.configResolved(config);
    });

    bench('Process 10 assets', () => {
      const assets = createMockAssets(10);
      // Just run the synchronous part of the method
      plugin.processAssets(assets, '/output/path');
    });

    bench('Process 100 assets', () => {
      const assets = createMockAssets(100);
      // Just run the synchronous part of the method
      plugin.processAssets(assets, '/output/path');
    });
  });
});

describe('withZephyr Function', () => {
  // Create mock implementation to avoid imports
  const mockWithZephyr = (opts = {}) => {
    return {
      name: 'vite-plugin-zephyr',
      configResolved: () => {},
      writeBundle: () => {},
    };
  };

  bench('Function call', () => {
    mockWithZephyr();
  });

  bench('With options', () => {
    mockWithZephyr({ wait_for_index_html: true });
  });

  bench('With MF config', () => {
    mockWithZephyr({ mfConfig: { name: 'host', remotes: {} } });
  });
});
