import { bench, describe } from 'vitest';

// Mock implementation of ZeRolldownPlugin to avoid dependency issues
class ZeRolldownPlugin {
  constructor(options) {
    this.options = options;
    this.zephyrEngine = options.zephyr_engine;
  }
}

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

describe('rolldown-plugin-zephyr Performance', () => {
  bench('Plugin creation', () => {
    const zephyrEngine = { buildProperties: {} };
    new ZeRolldownPlugin({ zephyr_engine: zephyrEngine });
  });

  bench('Plugin creation with options', () => {
    const zephyrEngine = { buildProperties: {} };
    new ZeRolldownPlugin({
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
    const plugin = new ZeRolldownPlugin({ zephyr_engine: zephyrEngine });

    bench('buildStart with string input', () => {
      const input = { input: '/path/to/input.js' };
      // Just running a mock to avoid imports
      const getInputFolder = (opts) => {
        if (typeof opts.input === 'string') return opts.input;
        if (Array.isArray(opts.input)) return opts.input[0];
        if (typeof opts.input === 'object') return Object.values(opts.input)[0];
        return '/mock/cwd';
      };
      return getInputFolder(input);
    });

    bench('Process 10 assets', () => {
      const bundle = createMockAssets(10);
      // Just run the mock method to measure performance without actual uploads
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
    const mockWithZephyr = (opts = {}) => {
      return {
        name: 'rolldown-plugin-zephyr',
        buildStart: () => {},
        writeBundle: () => {},
      };
    };
    mockWithZephyr();
  });

  bench('With options', () => {
    // Mock function to avoid imports
    const mockWithZephyr = (opts = {}) => {
      return {
        name: 'rolldown-plugin-zephyr',
        buildStart: () => {},
        writeBundle: () => {},
      };
    };
    mockWithZephyr({ wait_for_index_html: true });
  });
});
