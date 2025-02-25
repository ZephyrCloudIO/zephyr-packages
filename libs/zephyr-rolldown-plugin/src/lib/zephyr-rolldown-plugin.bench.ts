import { bench, describe, vi, beforeEach } from 'vitest';
import { withZephyr } from './zephyr-rolldown-plugin';

// Mock dependencies
const mockDefer = {
  zephyr_engine_defer: Promise.resolve({
    start_new_build: vi.fn().mockResolvedValue(undefined),
    upload_assets: vi.fn().mockResolvedValue(undefined),
    build_finished: vi.fn().mockResolvedValue(undefined),
  }),
  zephyr_defer_create: vi.fn(),
};

const mockZephyrAgent = {
  ZephyrEngine: {
    defer_create: vi.fn().mockReturnValue(mockDefer),
  },
  zeBuildDashData: vi.fn().mockResolvedValue({}),
};

const mockGetAssetsMap = {
  getAssetsMap: vi.fn().mockReturnValue({ 'test.js': 'content' }),
};

const mockProcess = {
  cwd: vi.fn().mockReturnValue('/mock/cwd'),
};

vi.mock('zephyr-agent', () => mockZephyrAgent);
vi.mock('./internal/get-assets-map', () => mockGetAssetsMap);
vi.mock('node:process', () => mockProcess);

describe('rolldown-plugin-zephyr Performance', () => {
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
