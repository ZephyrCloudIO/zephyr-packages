/* eslint-disable @typescript-eslint/no-explicit-any */
import { rs } from '@rstest/core';

const mockEngine = {
  env: { target: 'ios' as const },
  resolve_remote_dependencies: rs.fn().mockResolvedValue([
    {
      name: 'RemoteApp',
      version: 'latest',
      resolved_url: 'http://cdn.example.com/remote.js',
    },
  ]),
};

const zeLogConfigMock = rs.fn();
const zeLogAppMock = rs.fn();
const zeLogErrorMock = rs.fn();
const zeLogManifestMock = rs.fn();
const zephyrEngineCreateMock = rs.fn().mockResolvedValue(mockEngine);
const zephyrErrorFormatMock = rs.fn().mockImplementation((err) => String(err));
const createManifestContentMock = rs
  .fn()
  .mockReturnValue(JSON.stringify({ version: '1.0.0' }));
const handleGlobalErrorMock = rs.fn().mockImplementation((error) => {
  zeLogErrorMock(String(error));
});
const logFnMock = rs.fn();

rs.mock('zephyr-agent', () => ({
  ze_log: {
    config: (...args: unknown[]) => zeLogConfigMock(...args),
    app: (...args: unknown[]) => zeLogAppMock(...args),
    error: (...args: unknown[]) => zeLogErrorMock(...args),
    manifest: (...args: unknown[]) => zeLogManifestMock(...args),
  },
  ZephyrEngine: {
    create: (...args: unknown[]) => zephyrEngineCreateMock(...args),
  },
  ZephyrError: {
    format: (...args: unknown[]) => zephyrErrorFormatMock(...args),
  },
  ZeErrors: {
    ERR_UNKNOWN: 'ERR_UNKNOWN',
  },
  createManifestContent: (...args: unknown[]) =>
    createManifestContentMock(...args),
  handleGlobalError: (...args: unknown[]) => handleGlobalErrorMock(...args),
  logFn: (...args: unknown[]) => logFnMock(...args),
}));

const fsExistsSyncMock = rs.fn().mockReturnValue(true);
const fsMkdirSyncMock = rs.fn();
const fsWriteFileMock = rs.fn().mockResolvedValue(undefined);

rs.mock('fs', () => {
  const mockedFs = {
    existsSync: (...args: unknown[]) => fsExistsSyncMock(...args),
    mkdirSync: (...args: unknown[]) => fsMkdirSyncMock(...args),
    promises: {
      writeFile: (...args: unknown[]) => fsWriteFileMock(...args),
    },
  };
  return {
    ...mockedFs,
    default: mockedFs,
  };
});

import { withZephyr, withZephyrMetro } from '../with-zephyr';

describe('withZephyr integration', () => {
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
    zephyrEngineCreateMock.mockResolvedValue(mockEngine);
    mockEngine.resolve_remote_dependencies.mockResolvedValue([
      {
        name: 'RemoteApp',
        version: 'latest',
        resolved_url: 'http://cdn.example.com/remote.js',
      },
    ]);
  });

  describe('config transformation', () => {
    it('should return enhanced Metro config', async () => {
      const enhancer = withZephyr({ name: 'TestApp' });
      const result = await enhancer(baseMetroConfig);

      expect(result).toBeDefined();
      expect(result.transformer).toBeDefined();
      expect(result.resolver).toBeDefined();
      expect(result.server).toBeDefined();
    });

    it('should set custom transformer path', async () => {
      const enhancer = withZephyr({ name: 'TestApp' });
      const result = await enhancer(baseMetroConfig);

      expect(result.transformer?.babelTransformerPath).toBeDefined();
      expect(typeof result.transformer?.babelTransformerPath).toBe('string');
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

      result.server?.enhanceMiddleware?.(mockMiddleware, {})(
        mockReq,
        mockRes,
        mockNext
      );

      await new Promise(setImmediate);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/json'
      );
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

      result.server?.enhanceMiddleware?.(mockMiddleware, {})(
        mockReq,
        mockRes,
        mockNext
      );

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

      result.server?.enhanceMiddleware?.(mockMiddleware, {})(
        mockReq,
        mockRes,
        mockNext
      );

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

      result.server?.enhanceMiddleware?.(mockMiddleware, {})(
        mockReq,
        mockRes,
        mockNext
      );

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

      result.server?.enhanceMiddleware?.(mockMiddleware, {})(
        mockReq,
        mockRes,
        mockNext
      );

      await new Promise(setImmediate);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        'no-cache'
      );
    });
  });

  describe('transformer options', () => {
    it('should pass manifest path to transformer', async () => {
      const enhancer = withZephyr({
        name: 'TestApp',
        manifestPath: '/custom-path.json',
      });
      const result = await enhancer(baseMetroConfig);

      expect(
        (result.transformer as any).zephyrTransformerOptions?.manifestPath
      ).toBe('/custom-path.json');
    });

    it('should pass entry files to transformer', async () => {
      const enhancer = withZephyr({
        name: 'TestApp',
        entryFiles: ['main.tsx', 'App.tsx'],
      });
      const result = await enhancer(baseMetroConfig);

      expect(
        (result.transformer as any).zephyrTransformerOptions?.entryFiles
      ).toEqual(['main.tsx', 'App.tsx']);
    });
  });

  describe('error handling', () => {
    it('should return original config on ZephyrEngine.create error', async () => {
      zephyrEngineCreateMock.mockRejectedValueOnce(
        new Error('Engine init failed')
      );

      const enhancer = withZephyr({ name: 'TestApp' });
      const result = await enhancer(baseMetroConfig);

      expect(result).toEqual(baseMetroConfig);
      expect(zeLogErrorMock).toHaveBeenCalled();
    });
  });

  describe('legacy export', () => {
    it('should export withZephyrMetro as alias', () => {
      expect(withZephyrMetro).toBe(withZephyr);
    });
  });

  describe('ZephyrEngine initialization', () => {
    it('should create engine with metro builder', async () => {
      const enhancer = withZephyr({ name: 'TestApp' });
      await enhancer(baseMetroConfig);

      expect(zephyrEngineCreateMock).toHaveBeenCalledWith({
        builder: 'metro',
        context: '/project',
      });
    });

    it('should use process.cwd when projectRoot not specified', async () => {
      const configWithoutRoot = { ...baseMetroConfig, projectRoot: undefined };
      const enhancer = withZephyr({ name: 'TestApp' });
      await enhancer(configWithoutRoot);

      expect(zephyrEngineCreateMock).toHaveBeenCalledWith(
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

      result.server?.enhanceMiddleware?.(rs.fn(), {})(
        mockReq,
        mockRes,
        mockNext
      );

      expect(existingMiddleware).toHaveBeenCalled();
    });
  });
});
