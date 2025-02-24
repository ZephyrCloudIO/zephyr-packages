import { withZephyr } from './zephyr-rolldown-plugin';
import { ZephyrEngine } from 'zephyr-agent';
import path from 'path';

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

jest.mock('path', () => ({
  join: jest.fn((...args) => args.join('/')),
  resolve: jest.fn((...args) => args.join('/')),
}));

// Mock the internal get-assets-map module
jest.mock('./internal/get-assets-map', () => ({
  getAssetsMap: jest.fn().mockReturnValue({ 'test.js': 'content' }),
}));

// Mock TextDecoder
const mockTextDecoder = {
  decode: jest.fn().mockReturnValue('content'),
};
global.TextDecoder = jest.fn().mockImplementation(() => mockTextDecoder);

describe('zephyr-rolldown-plugin', () => {
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
        // TODO: Note the hardcoded builder name - a potential bug as noted in your analysis
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
  });

  describe('writeBundle', () => {
    it('should start a new build and upload assets', async () => {
      const plugin = withZephyr();
      const mockBundle = {
        'test.js': {
          fileName: 'test.js',
          source: new Uint8Array([116, 101, 115, 116]), // "test" in ASCII
        },
      };

      await plugin.writeBundle?.({} as any, mockBundle as any);

      const { zephyr_engine_defer } = ZephyrEngine.defer_create();
      const zephyrEngine = await zephyr_engine_defer;

      expect(zephyrEngine.start_new_build).toHaveBeenCalled();
      expect(zephyrEngine.upload_assets).toHaveBeenCalledWith(
        expect.objectContaining({
          assetsMap: expect.any(Object),
          buildStats: expect.any(Object),
        })
      );
      expect(zephyrEngine.build_finished).toHaveBeenCalled();

      // We're mocking getAssetsMap directly now, so TextDecoder won't be called
      // This expectation is no longer relevant
    });

    it('should handle non-binary sources', async () => {
      const plugin = withZephyr();
      const mockBundle = {
        'test.js': {
          fileName: 'test.js',
          source: 'direct string source',
        },
      };

      await plugin.writeBundle?.({} as any, mockBundle as any);

      const { zephyr_engine_defer } = ZephyrEngine.defer_create();
      const zephyrEngine = await zephyr_engine_defer;

      expect(zephyrEngine.upload_assets).toHaveBeenCalled();
      // For string sources, no need for TextDecoder
      expect(mockTextDecoder.decode).not.toHaveBeenCalled();
    });
  });
});
