import { fileURLToPath } from 'node:url';
import { logFn, zeBuildDashData, ZephyrEngine, ZephyrError } from 'zephyr-agent';
import { withZephyr } from '../astro-integration-zephyr';
import {
  extractAstroAssetsFromBuildHook,
  extractAstroAssetsMap,
} from '../internal/extract-astro-assets-map';

// Mock dependencies
jest.mock('zephyr-agent', () => ({
  ZephyrEngine: {
    defer_create: jest.fn(),
  },
  logFn: jest.fn(),
  ZephyrError: {
    format: jest.fn(),
  },
  zeBuildDashData: jest.fn(),
  handleGlobalError: jest.fn().mockImplementation((error) => {
    const mockLogFn = jest.requireMock('zephyr-agent').logFn;
    const mockZephyrError = jest.requireMock('zephyr-agent').ZephyrError;
    mockLogFn('error', mockZephyrError.format(error));
  }),
}));

jest.mock('node:url', () => ({
  fileURLToPath: jest.fn(),
}));

jest.mock('../internal/extract-astro-assets-map', () => ({
  extractAstroAssetsFromBuildHook: jest.fn(),
  extractAstroAssetsMap: jest.fn(),
}));

interface MockZephyrEngine {
  buildProperties: { output: string };
  start_new_build: jest.Mock;
  upload_assets: jest.Mock;
  build_finished: jest.Mock;
}

describe('withZephyr', () => {
  let mockZephyrEngine: MockZephyrEngine;
  let mockZephyrDefer: Promise<MockZephyrEngine>;
  let mockZephyrDeferCreate: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock ZephyrEngine setup
    mockZephyrEngine = {
      buildProperties: { output: '' },
      start_new_build: jest.fn(),
      upload_assets: jest.fn(),
      build_finished: jest.fn(),
    };

    mockZephyrDefer = Promise.resolve(mockZephyrEngine);

    mockZephyrDeferCreate = jest.fn();

    const mockDeferCreate = jest.fn().mockReturnValue({
      zephyr_engine_defer: mockZephyrDefer,
      zephyr_defer_create: mockZephyrDeferCreate,
    });

    (ZephyrEngine.defer_create as jest.Mock).mockImplementation(mockDeferCreate);

    (fileURLToPath as jest.Mock).mockImplementation((url: URL) => url.pathname);
    (extractAstroAssetsFromBuildHook as jest.Mock).mockResolvedValue({});
    (extractAstroAssetsMap as jest.Mock).mockResolvedValue({});
    (ZephyrError.format as jest.Mock).mockImplementation((error: Error) => error.message);
  });

  describe('Basic Integration Structure', () => {
    it('should return an Astro integration object', () => {
      const integration = withZephyr();

      expect(integration).toHaveProperty('name', 'with-zephyr');
      expect(integration).toHaveProperty('hooks');
      expect(integration.hooks).toHaveProperty('astro:config:done');
      expect(integration.hooks).toHaveProperty('astro:build:done');
    });

    it('should accept options parameter', () => {
      const integration = withZephyr();

      expect(integration).toHaveProperty('name', 'with-zephyr');
    });

    it('should have the correct hook functions', () => {
      const integration = withZephyr();

      expect(typeof integration.hooks['astro:config:done']).toBe('function');
      expect(typeof integration.hooks['astro:build:done']).toBe('function');
    });
  });

  describe('astro:config:done hook', () => {
    it('should initialize ZephyrEngine with correct context from config.root', async () => {
      const integration = withZephyr();

      const mockConfig = {
        root: new URL('file:///test/project/'),
      };

      await integration.hooks['astro:config:done']?.({
        config: mockConfig,
      } as Parameters<NonNullable<(typeof integration.hooks)['astro:config:done']>>[0]);

      expect(fileURLToPath).toHaveBeenCalledWith(mockConfig.root);
      expect(mockZephyrDeferCreate).toHaveBeenCalledWith({
        builder: 'astro',
        context: '/test/project/',
      });
    });
  });

  describe('astro:build:done hook', () => {
    it('should complete the full build workflow with assets parameter', async () => {
      const integration = withZephyr();
      const mockDir = new URL('file:///test/dist/');
      const mockAssets = { 'index.html': '/test/dist/index.html' };
      const mockAssetsMap = { hash1: { content: 'test', type: 'text/html' } };
      const mockBuildStats = { stats: 'test' };

      (extractAstroAssetsFromBuildHook as jest.Mock).mockResolvedValue(mockAssetsMap);
      (zeBuildDashData as jest.Mock).mockResolvedValue(mockBuildStats);

      await integration.hooks['astro:build:done']?.({
        dir: mockDir,
        assets: mockAssets,
      } as unknown as Parameters<
        NonNullable<(typeof integration.hooks)['astro:build:done']>
      >[0]);

      expect(fileURLToPath).toHaveBeenCalledWith(mockDir);
      expect(mockZephyrEngine.buildProperties.output).toBe('/test/dist/');
      expect(mockZephyrEngine.start_new_build).toHaveBeenCalled();
      expect(extractAstroAssetsFromBuildHook).toHaveBeenCalledWith(
        mockAssets,
        '/test/dist/'
      );
      expect(mockZephyrEngine.upload_assets).toHaveBeenCalledWith({
        assetsMap: mockAssetsMap,
        buildStats: mockBuildStats,
      });
      expect(mockZephyrEngine.build_finished).toHaveBeenCalled();
    });

    it('should handle missing assets parameter gracefully', async () => {
      const integration = withZephyr();
      const mockDir = new URL('file:///test/dist/');
      const mockAssetsMap = { hash1: { content: 'test', type: 'text/html' } };
      const mockBuildStats = { stats: 'test' };

      (extractAstroAssetsFromBuildHook as jest.Mock).mockResolvedValue(mockAssetsMap);
      (zeBuildDashData as jest.Mock).mockResolvedValue(mockBuildStats);

      // Call without assets parameter
      await integration.hooks['astro:build:done']?.({
        dir: mockDir,
      } as Parameters<NonNullable<(typeof integration.hooks)['astro:build:done']>>[0]);

      expect(extractAstroAssetsFromBuildHook).toHaveBeenCalledWith(
        undefined,
        '/test/dist/'
      );
      expect(mockZephyrEngine.upload_assets).toHaveBeenCalled();
    });

    it('should handle errors during build completion', async () => {
      const integration = withZephyr();
      const mockDir = new URL('file:///test/dist/');
      const mockAssets = { 'index.html': '/test/dist/index.html' };
      const testError = new Error('Build failed');

      (extractAstroAssetsFromBuildHook as jest.Mock).mockRejectedValue(testError);

      await integration.hooks['astro:build:done']?.({
        dir: mockDir,
        assets: mockAssets,
      } as unknown as Parameters<
        NonNullable<(typeof integration.hooks)['astro:build:done']>
      >[0]);

      expect(ZephyrError.format).toHaveBeenCalledWith(testError);
      expect(logFn).toHaveBeenCalledWith('error', 'Build failed');
    });

    it('should handle engine initialization errors', async () => {
      const badEngine = Promise.reject(new Error('Engine failed'));
      (ZephyrEngine.defer_create as jest.Mock).mockReturnValue({
        zephyr_engine_defer: badEngine,
        zephyr_defer_create: jest.fn(),
      });

      const integration = withZephyr();
      const mockDir = new URL('file:///test/dist/');

      await integration.hooks['astro:build:done']?.({
        dir: mockDir,
      } as Parameters<NonNullable<(typeof integration.hooks)['astro:build:done']>>[0]);

      expect(ZephyrError.format).toHaveBeenCalledWith(new Error('Engine failed'));
      expect(logFn).toHaveBeenCalledWith('error', 'Engine failed');
    });
  });

  describe('Integration Lifecycle', () => {
    it('should handle sequential hook calls correctly', async () => {
      const integration = withZephyr();

      // First call config:done
      const mockConfig = { root: new URL('file:///test/project/') };
      await integration.hooks['astro:config:done']?.({
        config: mockConfig,
      } as Parameters<NonNullable<(typeof integration.hooks)['astro:config:done']>>[0]);

      // Then call build:done
      const mockDir = new URL('file:///test/dist/');
      await integration.hooks['astro:build:done']?.({
        dir: mockDir,
      } as Parameters<NonNullable<(typeof integration.hooks)['astro:build:done']>>[0]);

      expect(mockZephyrEngine.start_new_build).toHaveBeenCalled();
      expect(mockZephyrEngine.build_finished).toHaveBeenCalled();
    });
  });
});
