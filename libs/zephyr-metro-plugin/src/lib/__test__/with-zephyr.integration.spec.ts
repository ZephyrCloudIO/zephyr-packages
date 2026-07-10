import { beforeEach, describe, expect, it, rs } from '@rstest/core';

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Integration tests for withZephyr Metro configuration */

// Mock zephyr-agent - must be before imports
rs.mock('zephyr-agent', () => {
  const mockEngine = {
    env: { target: 'ios' as const },
    build_id: Promise.resolve('build-id'),
    build_failed: rs.fn(),
    resolve_remote_dependencies: rs.fn().mockResolvedValue([
      {
        name: 'RemoteApp',
        version: 'latest',
        resolved_url: 'http://cdn.example.com/remote.js',
      },
    ]),
  };

  const mockZeLog = {
    config: rs.fn(),
    app: rs.fn(),
    error: rs.fn(),
    manifest: rs.fn(),
  };

  return {
    ze_log: mockZeLog,
    ZephyrEngine: {
      create: rs.fn().mockResolvedValue(mockEngine),
    },
    ZephyrError: {
      format: rs.fn().mockImplementation((err) => String(err)),
    },
    ZeErrors: {
      ERR_UNKNOWN: 'ERR_UNKNOWN',
    },
    createManifestContent: rs.fn().mockReturnValue(JSON.stringify({ version: '1.0.0' })),
    handleGlobalError: rs.fn().mockImplementation((error) => {
      mockZeLog.error(String(error));
    }),
    logFn: rs.fn(),
  };
});

// Mock fs for manifest generation
rs.mock('fs', () => ({
  existsSync: rs.fn().mockReturnValue(true),
  mkdirSync: rs.fn(),
  promises: {
    writeFile: rs.fn().mockResolvedValue(undefined),
  },
}));

import { withZephyr, withZephyrMetro } from '../with-zephyr';

describe('withZephyr integration', () => {
  // Sample Metro config
  const baseMetroConfig: any = {
    projectRoot: '/project',
    transformer: {
      babelTransformerPath: 'metro-react-native-babel-transformer',
    },
    resolver: {
      resolverMainFields: ['react-native', 'browser', 'main'],
    },
    server: {},
  };

  beforeEach(() => {
    rs.clearAllMocks();
  });

  describe('config transformation', () => {
    it('should return enhanced Metro config', async () => {
      const enhancer = withZephyr({ name: 'TestApp' });
      const result = await enhancer(baseMetroConfig);

      expect(result).toBeDefined();
      expect(result.resolver).toBeDefined();
      expect(result.server).toBeDefined();
    });

    it('should add zephyr to resolver main fields', async () => {
      const enhancer = withZephyr({ name: 'TestApp' });
      const result = await enhancer(baseMetroConfig);

      expect(result.resolver?.resolverMainFields).toContain('zephyr');
    });

    it('should preserve existing resolver main fields', async () => {
      const enhancer = withZephyr({ name: 'TestApp' });
      const result = await enhancer(baseMetroConfig);

      expect(result.resolver?.resolverMainFields).toContain('react-native');
      expect(result.resolver?.resolverMainFields).toContain('browser');
      expect(result.resolver?.resolverMainFields).toContain('main');
    });

    it('should add server middleware enhancement', async () => {
      const enhancer = withZephyr({ name: 'TestApp' });
      const result = await enhancer(baseMetroConfig);

      expect(result.server?.enhanceMiddleware).toBeDefined();
      expect(typeof result.server?.enhanceMiddleware).toBe('function');
    });
  });

  describe('manifest endpoint middleware', () => {
    it('should serve manifest at default path', async () => {
      const enhancer = withZephyr({ name: 'TestApp' });
      const result = await enhancer(baseMetroConfig);

      const mockReq = { url: '/zephyr-manifest.json' };
      const mockRes = {
        setHeader: rs.fn(),
        end: rs.fn(),
      };
      const mockNext = rs.fn();
      const mockMiddleware = rs.fn();

      result.server?.enhanceMiddleware?.(mockMiddleware, {})(mockReq, mockRes, mockNext);

      // Wait for async middleware to complete
      await new Promise(setImmediate);

      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json');
      expect(mockRes.end).toHaveBeenCalled();
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should serve manifest at custom path', async () => {
      const enhancer = withZephyr({
        name: 'TestApp',
        manifestPath: '/custom-manifest.json',
      });
      const result = await enhancer(baseMetroConfig);

      const mockReq = { url: '/custom-manifest.json' };
      const mockRes = {
        setHeader: rs.fn(),
        end: rs.fn(),
      };
      const mockNext = rs.fn();
      const mockMiddleware = rs.fn();

      result.server?.enhanceMiddleware?.(mockMiddleware, {})(mockReq, mockRes, mockNext);

      // Wait for async middleware to complete
      await new Promise(setImmediate);

      expect(mockRes.end).toHaveBeenCalled();
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should pass through non-manifest requests', async () => {
      const enhancer = withZephyr({ name: 'TestApp' });
      const result = await enhancer(baseMetroConfig);

      const mockReq = { url: '/some-other-endpoint' };
      const mockRes = {
        setHeader: rs.fn(),
        end: rs.fn(),
      };
      const mockNext = rs.fn();
      const mockMiddleware = rs.fn();

      result.server?.enhanceMiddleware?.(mockMiddleware, {})(mockReq, mockRes, mockNext);

      expect(mockMiddleware).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
    });

    it('should handle query strings in manifest URL', async () => {
      const enhancer = withZephyr({ name: 'TestApp' });
      const result = await enhancer(baseMetroConfig);

      const mockReq = { url: '/zephyr-manifest.json?cacheBust=123' };
      const mockRes = {
        setHeader: rs.fn(),
        end: rs.fn(),
      };
      const mockNext = rs.fn();
      const mockMiddleware = rs.fn();

      result.server?.enhanceMiddleware?.(mockMiddleware, {})(mockReq, mockRes, mockNext);

      // Wait for async middleware to complete
      await new Promise(setImmediate);

      expect(mockRes.end).toHaveBeenCalled();
    });

    it('should set no-cache header for manifest', async () => {
      const enhancer = withZephyr({ name: 'TestApp' });
      const result = await enhancer(baseMetroConfig);

      const mockReq = { url: '/zephyr-manifest.json' };
      const mockRes = {
        setHeader: rs.fn(),
        end: rs.fn(),
      };
      const mockNext = rs.fn();
      const mockMiddleware = rs.fn();

      result.server?.enhanceMiddleware?.(mockMiddleware, {})(mockReq, mockRes, mockNext);

      // Wait for async middleware to complete
      await new Promise(setImmediate);

      expect(mockRes.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache');
    });
  });

  describe('error handling', () => {
    it('should return original config on ZephyrEngine.create error', async () => {
      const { ZephyrEngine, ze_log } = require('zephyr-agent');
      ZephyrEngine.create.mockRejectedValueOnce(new Error('Engine init failed'));

      const enhancer = withZephyr({ name: 'TestApp' });
      const result = await enhancer(baseMetroConfig);

      expect(result).toEqual(baseMetroConfig);
      expect(ze_log.error).toHaveBeenCalled();
    });
  });

  describe('legacy export', () => {
    it('should export withZephyrMetro as alias', () => {
      expect(withZephyrMetro).toBe(withZephyr);
    });
  });

  describe('ZephyrEngine initialization', () => {
    it('should create engine with metro builder', async () => {
      const { ZephyrEngine } = require('zephyr-agent');

      const enhancer = withZephyr({ name: 'TestApp' });
      await enhancer(baseMetroConfig);

      expect(ZephyrEngine.create).toHaveBeenCalledWith({
        builder: 'metro',
        context: '/project',
      });
    });

    it('should use process.cwd when projectRoot not specified', async () => {
      const { ZephyrEngine } = require('zephyr-agent');

      const configWithoutRoot = { ...baseMetroConfig, projectRoot: undefined };
      const enhancer = withZephyr({ name: 'TestApp' });
      await enhancer(configWithoutRoot);

      expect(ZephyrEngine.create).toHaveBeenCalledWith(
        expect.objectContaining({
          context: expect.any(String),
        })
      );
    });
  });

  describe('middleware chaining', () => {
    it('should chain with existing enhanceMiddleware', async () => {
      const existingMiddleware = rs.fn().mockReturnValue(rs.fn());
      const configWithMiddleware = {
        ...baseMetroConfig,
        server: {
          enhanceMiddleware: existingMiddleware,
        },
      };

      const enhancer = withZephyr({ name: 'TestApp' });
      const result = await enhancer(configWithMiddleware);

      const mockReq = { url: '/other-path' };
      const mockRes = {};
      const mockNext = rs.fn();

      result.server?.enhanceMiddleware?.(rs.fn(), {})(mockReq, mockRes, mockNext);

      expect(existingMiddleware).toHaveBeenCalled();
    });
  });
});
