import { rs } from '@rstest/core';
import { withZephyr } from '../astro-integration-zephyr';

const mockLogFn = rs.fn();
const mockZephyrErrorFormat = rs.fn((error: unknown) =>
  error instanceof Error ? error.message : String(error)
);
const mockZeBuildDashData = rs.fn();
const mockHandleGlobalError = rs.fn((error: unknown) => {
  mockLogFn('error', mockZephyrErrorFormat(error));
});
const mockDeferCreate = rs.fn();
const mockFileURLToPath = rs.fn((url: URL) => url.pathname);
const mockExtractAstroAssetsFromBuildHook = rs.fn();
const mockExtractAstroAssetsMap = rs.fn();

rs.mock('zephyr-agent', () => ({
  ZephyrEngine: {
    defer_create: (...args: unknown[]) => mockDeferCreate(...args),
  },
  logFn: (...args: unknown[]) => mockLogFn(...args),
  ZephyrError: {
    format: (...args: unknown[]) => mockZephyrErrorFormat(...args),
  },
  zeBuildDashData: (...args: unknown[]) => mockZeBuildDashData(...args),
  handleGlobalError: (...args: unknown[]) => mockHandleGlobalError(...args),
}));

rs.mock('node:url', () => ({
  fileURLToPath: (...args: unknown[]) => mockFileURLToPath(...args),
}));

rs.mock('../internal/extract-astro-assets-map', () => ({
  extractAstroAssetsFromBuildHook: (...args: unknown[]) =>
    mockExtractAstroAssetsFromBuildHook(...args),
  extractAstroAssetsMap: (...args: unknown[]) => mockExtractAstroAssetsMap(...args),
}));

type MockFn = ReturnType<typeof rs.fn>;

interface MockZephyrEngine {
  buildProperties: { output: string };
  start_new_build: MockFn;
  upload_assets: MockFn;
  build_finished: MockFn;
}

describe('withZephyr', () => {
  let mockZephyrEngine: MockZephyrEngine;
  let mockZephyrDefer: Promise<MockZephyrEngine>;
  let mockZephyrDeferCreate: MockFn;

  beforeEach(() => {
    rs.clearAllMocks();

    mockZephyrEngine = {
      buildProperties: { output: '' },
      start_new_build: rs.fn(),
      upload_assets: rs.fn(),
      build_finished: rs.fn(),
    };

    mockZephyrDefer = Promise.resolve(mockZephyrEngine);
    mockZephyrDeferCreate = rs.fn();

    mockDeferCreate.mockReturnValue({
      zephyr_engine_defer: mockZephyrDefer,
      zephyr_defer_create: mockZephyrDeferCreate,
    });

    mockFileURLToPath.mockImplementation((url: URL) => url.pathname);
    mockExtractAstroAssetsFromBuildHook.mockResolvedValue({});
    mockExtractAstroAssetsMap.mockResolvedValue({});
    mockZeBuildDashData.mockResolvedValue({});
    mockZephyrErrorFormat.mockImplementation((error: unknown) =>
      error instanceof Error ? error.message : String(error)
    );
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

      expect(mockFileURLToPath).toHaveBeenCalledWith(mockConfig.root);
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

      mockExtractAstroAssetsFromBuildHook.mockResolvedValue(mockAssetsMap);
      mockZeBuildDashData.mockResolvedValue(mockBuildStats);

      await integration.hooks['astro:build:done']?.({
        dir: mockDir,
        assets: mockAssets,
      } as unknown as Parameters<
        NonNullable<(typeof integration.hooks)['astro:build:done']>
      >[0]);

      expect(mockFileURLToPath).toHaveBeenCalledWith(mockDir);
      expect(mockZephyrEngine.buildProperties.output).toBe('/test/dist/');
      expect(mockZephyrEngine.start_new_build).toHaveBeenCalled();
      expect(mockExtractAstroAssetsFromBuildHook).toHaveBeenCalledWith(
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

      mockExtractAstroAssetsFromBuildHook.mockResolvedValue(mockAssetsMap);
      mockZeBuildDashData.mockResolvedValue(mockBuildStats);

      await integration.hooks['astro:build:done']?.({
        dir: mockDir,
      } as Parameters<NonNullable<(typeof integration.hooks)['astro:build:done']>>[0]);

      expect(mockExtractAstroAssetsFromBuildHook).toHaveBeenCalledWith(
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

      mockExtractAstroAssetsFromBuildHook.mockRejectedValue(testError);

      await integration.hooks['astro:build:done']?.({
        dir: mockDir,
        assets: mockAssets,
      } as unknown as Parameters<
        NonNullable<(typeof integration.hooks)['astro:build:done']>
      >[0]);

      expect(mockZephyrErrorFormat).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Build failed' })
      );
      expect(mockLogFn).toHaveBeenCalledWith('error', 'Build failed');
    });

    it('should handle engine initialization errors', async () => {
      mockDeferCreate.mockReturnValueOnce({
        zephyr_engine_defer: Promise.reject(new Error('Engine failed')),
        zephyr_defer_create: rs.fn(),
      });

      const integration = withZephyr();
      const mockDir = new URL('file:///test/dist/');

      await integration.hooks['astro:build:done']?.({
        dir: mockDir,
      } as Parameters<NonNullable<(typeof integration.hooks)['astro:build:done']>>[0]);

      expect(mockZephyrErrorFormat).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Engine failed' })
      );
      expect(mockLogFn).toHaveBeenCalledWith('error', 'Engine failed');
    });
  });

  describe('Integration Lifecycle', () => {
    it('should handle sequential hook calls correctly', async () => {
      const integration = withZephyr();

      const mockConfig = { root: new URL('file:///test/project/') };
      await integration.hooks['astro:config:done']?.({
        config: mockConfig,
      } as Parameters<NonNullable<(typeof integration.hooks)['astro:config:done']>>[0]);

      const mockDir = new URL('file:///test/dist/');
      await integration.hooks['astro:build:done']?.({
        dir: mockDir,
      } as Parameters<NonNullable<(typeof integration.hooks)['astro:build:done']>>[0]);

      expect(mockZephyrEngine.start_new_build).toHaveBeenCalled();
      expect(mockZephyrEngine.build_finished).toHaveBeenCalled();
    });
  });
});
