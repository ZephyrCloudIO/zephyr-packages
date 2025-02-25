import { withZephyr } from './rollup-plugin-zephyr';
import { ZephyrEngine } from 'zephyr-agent';

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

// Mock the ZeRollupPlugin class
jest.mock('./ze-rollup-plugin', () => {
  const mockProcessAssets = jest.fn().mockResolvedValue({ success: true });

  return {
    ZeRollupPlugin: jest.fn().mockImplementation(() => ({
      pluginName: 'ze-rollup-plugin',
      processAssets: mockProcessAssets,
      getRollupPlugin: () => ({
        name: 'ze-rollup-plugin',
        buildStart: jest.fn(),
        writeBundle: jest.fn(),
      }),
    })),
  };
});

// Mock ZeBasePlugin
jest.mock('zephyr-xpack-internal', () => ({
  ZeBasePlugin: class {},
  ZeProcessAssetsResult: {},
}));

describe('rollup-plugin-zephyr', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('withZephyr', () => {
    it('should return a plugin with the correct name', () => {
      const plugin = withZephyr();
      expect(plugin.name).toBe('ze-rollup-plugin');
    });

    it('should create a plugin that implements the Rollup Plugin interface', () => {
      const plugin = withZephyr();

      // Test that it has the expected plugin methods
      expect(typeof plugin.name).toBe('string');
      expect(typeof plugin.buildStart).toBe('function');
      expect(typeof plugin.writeBundle).toBe('function');
    });

    it('should pass user options to the plugin', () => {
      const plugin = withZephyr({ wait_for_index_html: true });

      expect(plugin.name).toBe('ze-rollup-plugin');
      // Verify that ZephyrEngine.defer_create was called
      expect(ZephyrEngine.defer_create).toHaveBeenCalled();
    });
  });

  describe('plugin initialization', () => {
    it('should initialize zephyr engine on creation', () => {
      withZephyr();

      const { zephyr_defer_create } = ZephyrEngine.defer_create();
      expect(zephyr_defer_create).toHaveBeenCalledWith({
        builder: 'rollup',
        context: '/mock/cwd',
      });
    });
  });
});
