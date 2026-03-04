/* eslint-disable @typescript-eslint/no-explicit-any */
import { rs } from '@rstest/core';

var zephyrErrorCtorMock = rs.fn().mockImplementation((error, options) => {
  return { error, options };
});

function MockZephyrError(this: any, error: unknown, options?: { message?: string }) {
  const message = options?.message || String(error);
  const errorInstance = new Error(message) as Error & { code?: unknown };
  errorInstance.code = error;
  zephyrErrorCtorMock(error, options);
  return errorInstance;
}

MockZephyrError.prototype = Error.prototype;

rs.mock('zephyr-agent', () => ({
  ZephyrError: MockZephyrError,
  ZeErrors: {
    ERR_UNKNOWN: 'ERR_UNKNOWN',
    ERR_INVALID_MF_CONFIG: 'ERR_INVALID_MF_CONFIG',
  },
}));

type MockFn = ReturnType<typeof rs.fn>;

let mockBeforeBuild: MockFn = rs.fn();
let mockAfterBuild: MockFn = rs.fn();
const zephyrMetroPluginCtorMock = rs.fn();

function MockZephyrMetroPlugin(this: any, ...args: unknown[]) {
  zephyrMetroPluginCtorMock(...args);
  return {
    beforeBuild: (...hookArgs: unknown[]) => mockBeforeBuild(...hookArgs),
    afterBuild: (...hookArgs: unknown[]) => mockAfterBuild(...hookArgs),
  };
}

rs.mock('../zephyr-metro-plugin', () => ({
  ZephyrMetroPlugin: MockZephyrMetroPlugin,
}));

rs.mock('../internal/metro-errors', () => ({
  ERR_MISSING_METRO_FEDERATION_CONFIG: 'ERR_INVALID_MF_CONFIG',
}));

import { zephyrCommandWrapper } from '../zephyr-metro-command-wrapper';

describe('zephyrCommandWrapper', () => {
  const mockBundleFederatedRemote = rs.fn().mockResolvedValue({ success: true });
  const mockLoadMetroConfig = rs.fn().mockResolvedValue({});
  const mockUpdateManifest = rs.fn();

  const createMockArgs = (overrides: any = {}): any => [
    [{ mode: overrides.mode ?? 'production', platform: overrides.platform ?? 'ios' }],
    { root: overrides.root ?? '/project', ...overrides.configOptions },
    { maxWorkers: 4, resetCache: false, config: 'metro.config.js' },
  ];

  beforeEach(() => {
    rs.clearAllMocks();
    mockBeforeBuild.mockResolvedValue({ name: 'TestApp' });
    mockAfterBuild.mockResolvedValue(undefined);

    (global as any).__METRO_FEDERATION_CONFIG = {
      name: 'TestApp',
      remotes: {},
    };
  });

  afterEach(() => {
    delete (global as any).__METRO_FEDERATION_CONFIG;
  });

  describe('wrapper creation', () => {
    it('should return an async function', async () => {
      const wrapper = await zephyrCommandWrapper(
        mockBundleFederatedRemote,
        mockLoadMetroConfig,
        mockUpdateManifest
      );

      expect(typeof wrapper).toBe('function');
    });
  });

  describe('execution flow', () => {
    it('should load metro config with correct options', async () => {
      const wrapper = await zephyrCommandWrapper(
        mockBundleFederatedRemote,
        mockLoadMetroConfig,
        mockUpdateManifest
      );

      const args = createMockArgs();
      await wrapper(...args);

      expect(mockLoadMetroConfig).toHaveBeenCalledWith(args[1], {
        maxWorkers: 4,
        resetCache: false,
        config: 'metro.config.js',
      });
    });

    it('should call beforeBuild on plugin', async () => {
      const wrapper = await zephyrCommandWrapper(
        mockBundleFederatedRemote,
        mockLoadMetroConfig,
        mockUpdateManifest
      );

      await wrapper(...createMockArgs());

      expect(mockBeforeBuild).toHaveBeenCalled();
    });

    it('should update manifest after beforeBuild', async () => {
      const wrapper = await zephyrCommandWrapper(
        mockBundleFederatedRemote,
        mockLoadMetroConfig,
        mockUpdateManifest
      );

      await wrapper(...createMockArgs());

      expect(mockUpdateManifest).toHaveBeenCalled();
    });

    it('should call original bundle function', async () => {
      const wrapper = await zephyrCommandWrapper(
        mockBundleFederatedRemote,
        mockLoadMetroConfig,
        mockUpdateManifest
      );

      const args = createMockArgs();
      await wrapper(...args);

      expect(mockBundleFederatedRemote).toHaveBeenCalledWith(...args);
    });

    it('should call afterBuild on plugin', async () => {
      const wrapper = await zephyrCommandWrapper(
        mockBundleFederatedRemote,
        mockLoadMetroConfig,
        mockUpdateManifest
      );

      await wrapper(...createMockArgs());

      expect(mockAfterBuild).toHaveBeenCalled();
    });

    it('should return result from bundle function', async () => {
      mockBundleFederatedRemote.mockResolvedValue({ bundled: true, files: ['main.js'] });

      const wrapper = await zephyrCommandWrapper(
        mockBundleFederatedRemote,
        mockLoadMetroConfig,
        mockUpdateManifest
      );

      const result = await wrapper(...createMockArgs());

      expect(result).toEqual({ bundled: true, files: ['main.js'] });
    });
  });

  describe('platform handling', () => {
    it('should pass iOS platform to plugin', async () => {
      const wrapper = await zephyrCommandWrapper(
        mockBundleFederatedRemote,
        mockLoadMetroConfig,
        mockUpdateManifest
      );

      await wrapper(...createMockArgs({ platform: 'ios' }));

      expect(zephyrMetroPluginCtorMock).toHaveBeenCalledWith(
        expect.objectContaining({
          platform: 'ios',
        })
      );
    });

    it('should pass Android platform to plugin', async () => {
      const wrapper = await zephyrCommandWrapper(
        mockBundleFederatedRemote,
        mockLoadMetroConfig,
        mockUpdateManifest
      );

      await wrapper(...createMockArgs({ platform: 'android' }));

      expect(zephyrMetroPluginCtorMock).toHaveBeenCalledWith(
        expect.objectContaining({
          platform: 'android',
        })
      );
    });
  });

  describe('mode handling', () => {
    it('should set development mode when mode is truthy', async () => {
      const wrapper = await zephyrCommandWrapper(
        mockBundleFederatedRemote,
        mockLoadMetroConfig,
        mockUpdateManifest
      );

      await wrapper(...createMockArgs({ mode: 'development' }));

      expect(zephyrMetroPluginCtorMock).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'development',
        })
      );
    });

    it('should set production mode when mode is falsy', async () => {
      const wrapper = await zephyrCommandWrapper(
        mockBundleFederatedRemote,
        mockLoadMetroConfig,
        mockUpdateManifest
      );

      await wrapper(...createMockArgs({ mode: '' }));

      expect(zephyrMetroPluginCtorMock).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'production',
        })
      );
    });
  });

  describe('error handling', () => {
    it('should throw ZephyrError when federation config is missing', async () => {
      delete (global as any).__METRO_FEDERATION_CONFIG;

      const wrapper = await zephyrCommandWrapper(
        mockBundleFederatedRemote,
        mockLoadMetroConfig,
        mockUpdateManifest
      );

      await expect(wrapper(...createMockArgs())).rejects.toThrow();
    });

    it('should throw ZephyrError when bundle function fails', async () => {
      mockBundleFederatedRemote.mockRejectedValue(new Error('Bundle failed'));

      const wrapper = await zephyrCommandWrapper(
        mockBundleFederatedRemote,
        mockLoadMetroConfig,
        mockUpdateManifest
      );

      await expect(wrapper(...createMockArgs())).rejects.toThrow();
    });

    it('should throw ZephyrError when beforeBuild fails', async () => {
      mockBeforeBuild.mockRejectedValue(new Error('beforeBuild failed'));

      const wrapper = await zephyrCommandWrapper(
        mockBundleFederatedRemote,
        mockLoadMetroConfig,
        mockUpdateManifest
      );

      await expect(wrapper(...createMockArgs())).rejects.toThrow();
    });

    it('should throw ZephyrError when afterBuild fails', async () => {
      mockAfterBuild.mockRejectedValue(new Error('afterBuild failed'));

      const wrapper = await zephyrCommandWrapper(
        mockBundleFederatedRemote,
        mockLoadMetroConfig,
        mockUpdateManifest
      );

      await expect(wrapper(...createMockArgs())).rejects.toThrow();
    });
  });

  describe('execution order', () => {
    it('should execute hooks in correct order', async () => {
      const executionOrder: string[] = [];

      mockLoadMetroConfig.mockImplementation(async () => {
        executionOrder.push('loadConfig');
        return {};
      });

      mockBeforeBuild.mockImplementation(async () => {
        executionOrder.push('beforeBuild');
        return { name: 'TestApp' };
      });

      mockUpdateManifest.mockImplementation(() => {
        executionOrder.push('updateManifest');
      });

      mockBundleFederatedRemote.mockImplementation(async () => {
        executionOrder.push('bundle');
        return { success: true };
      });

      mockAfterBuild.mockImplementation(async () => {
        executionOrder.push('afterBuild');
      });

      const wrapper = await zephyrCommandWrapper(
        mockBundleFederatedRemote,
        mockLoadMetroConfig,
        mockUpdateManifest
      );

      await wrapper(...createMockArgs());

      expect(executionOrder).toEqual([
        'loadConfig',
        'beforeBuild',
        'updateManifest',
        'bundle',
        'afterBuild',
      ]);
    });
  });

  describe('context handling', () => {
    it('should use root from config as context', async () => {
      const wrapper = await zephyrCommandWrapper(
        mockBundleFederatedRemote,
        mockLoadMetroConfig,
        mockUpdateManifest
      );

      await wrapper(...createMockArgs({ root: '/custom/project/path' }));

      expect(zephyrMetroPluginCtorMock).toHaveBeenCalledWith(
        expect.objectContaining({
          context: '/custom/project/path',
        })
      );
    });
  });
});
