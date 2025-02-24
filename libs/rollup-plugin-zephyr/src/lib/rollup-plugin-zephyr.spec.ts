import { withZephyr } from './rollup-plugin-zephyr';
import { ZephyrEngine } from 'zephyr-agent';
import { getAssetsMap } from './transform/get-assets-map';

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

describe('rollup-plugin-zephyr', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('withZephyr', () => {
    it('should return a plugin with the correct name', () => {
      const plugin = withZephyr();
      expect(plugin.name).toBe('with-zephyr');
    });
  });

  describe('getInputFolder', () => {
    it('should handle string input', async () => {
      const plugin = withZephyr();
      await plugin.buildStart?.({ input: '/path/to/input.js' } as any);

      const { zephyr_defer_create } = ZephyrEngine.defer_create();
      expect(zephyr_defer_create).toHaveBeenCalledWith({
        builder: 'rollup',
        context: '/path/to/input.js',
      });
    });

    it('should handle array input by taking the first item', async () => {
      const plugin = withZephyr();
      await plugin.buildStart?.({ input: ['/path/one.js', '/path/two.js'] } as any);

      const { zephyr_defer_create } = ZephyrEngine.defer_create();
      expect(zephyr_defer_create).toHaveBeenCalledWith({
        builder: 'rollup',
        context: '/path/one.js',
      });
    });

    it('should handle object input by taking the first value', async () => {
      const plugin = withZephyr();
      await plugin.buildStart?.({
        input: { main: '/path/main.js', secondary: '/path/secondary.js' },
      } as any);

      const { zephyr_defer_create } = ZephyrEngine.defer_create();
      expect(zephyr_defer_create).toHaveBeenCalledWith({
        builder: 'rollup',
        context: '/path/main.js',
      });
    });

    it('should fall back to cwd if input is not provided', async () => {
      const plugin = withZephyr();
      await plugin.buildStart?.({} as any);

      const { zephyr_defer_create } = ZephyrEngine.defer_create();
      expect(zephyr_defer_create).toHaveBeenCalledWith({
        builder: 'rollup',
        context: '/mock/cwd',
      });
    });
  });

  describe('writeBundle', () => {
    it('should start a new build and upload assets', async () => {
      const plugin = withZephyr();
      const mockBundle = { 'test.js': { fileName: 'test.js', source: 'content' } };

      await plugin.writeBundle?.({} as any, mockBundle as any);

      const { zephyr_engine_defer } = ZephyrEngine.defer_create();
      const zephyrEngine = await zephyr_engine_defer;

      expect(zephyrEngine.start_new_build).toHaveBeenCalled();
      expect(getAssetsMap).toHaveBeenCalledWith(mockBundle);
      expect(zephyrEngine.upload_assets).toHaveBeenCalled();
      expect(zephyrEngine.build_finished).toHaveBeenCalled();
    });
  });
});
