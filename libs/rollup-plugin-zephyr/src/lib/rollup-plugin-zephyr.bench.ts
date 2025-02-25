import { bench, describe } from 'vitest';
import { withZephyr } from './rollup-plugin-zephyr';

// Mock dependencies
jest.mock('zephyr-agent', () => {
  const mockDefer = {
    zephyr_engine_defer: Promise.resolve({
      start_new_build: jest.fn().mockResolvedValue(undefined),
      upload_assets: jest.fn().mockResolvedValue(undefined),
      build_finished: jest.fn().mockResolvedValue(undefined),
    }),
    zephyr_defer_create: jest.fn(),
  };

  return {
    ZephyrEngine: {
      defer_create: jest.fn().mockReturnValue(mockDefer),
    },
    zeBuildDashData: jest.fn().mockResolvedValue({}),
  };
});

jest.mock('./transform/get-assets-map', () => ({
  getAssetsMap: jest.fn().mockReturnValue({ 'test.js': 'content' }),
}));

jest.mock('node:process', () => ({
  cwd: jest.fn().mockReturnValue('/mock/cwd'),
}));

describe('rollup-plugin-zephyr Performance', () => {
  bench('Plugin creation', () => {
    withZephyr();
  });

  describe('Plugin Hooks', () => {
    let plugin: any;

    beforeEach(() => {
      plugin = withZephyr();
    });

    bench('buildStart with string input', () => {
      // Just test the synchronous part
      const input = { input: '/path/to/input.js' };
      plugin.buildStart(input);
    });

    bench('buildStart with array input', () => {
      const input = { input: ['/path/one.js', '/path/two.js'] };
      plugin.buildStart(input);
    });

    bench('buildStart with object input', () => {
      const input = { input: { main: '/path/main.js', secondary: '/path/secondary.js' } };
      plugin.buildStart(input);
    });

    bench('buildStart with no input', () => {
      const input = {};
      plugin.buildStart(input);
    });

    bench('writeBundle', () => {
      const mockBundle = {
        'test.js': {
          fileName: 'test.js',
          source: new Uint8Array([116, 101, 115, 116]), // "test" in ASCII
        },
      };

      // Just test the synchronous part
      plugin.writeBundle({}, mockBundle);
    });
  });
});
