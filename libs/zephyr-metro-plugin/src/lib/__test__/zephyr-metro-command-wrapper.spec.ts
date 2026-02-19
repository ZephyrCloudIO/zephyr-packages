/* eslint-disable @typescript-eslint/no-explicit-any */
/** Unit tests for zephyrCommandWrapper */

// Mock zephyr-agent - must be before imports
jest.mock('zephyr-agent', () => ({
  ZephyrError: jest.fn().mockImplementation((error, options) => {
    const err = new Error(options?.message || error);
    (err as any).code = error;
    return err;
  }),
  ZeErrors: {
    ERR_UNKNOWN: 'ERR_UNKNOWN',
    ERR_INVALID_MF_CONFIG: 'ERR_INVALID_MF_CONFIG',
  },
}));

// Mock functions stored at module level for access in tests
let mockBeforeBuild: jest.Mock;
let mockAfterBuild: jest.Mock;

// Mock ZephyrMetroPlugin
jest.mock('../zephyr-metro-plugin', () => {
  mockBeforeBuild = jest.fn().mockResolvedValue({ name: 'TestApp' });
  mockAfterBuild = jest.fn().mockResolvedValue(undefined);
  return {
    ZephyrMetroPlugin: jest.fn().mockImplementation(() => ({
      beforeBuild: mockBeforeBuild,
      afterBuild: mockAfterBuild,
    })),
  };
});

// Mock internal errors
jest.mock('../internal/metro-errors', () => ({
  ERR_MISSING_METRO_FEDERATION_CONFIG: 'ERR_INVALID_MF_CONFIG',
}));

import { zephyrCommandWrapper } from '../zephyr-metro-command-wrapper';

describe('zephyrCommandWrapper', () => {
  // Mock functions
  const mockBundleFederatedRemote = jest.fn().mockResolvedValue({ success: true });
  const mockLoadMetroConfig = jest.fn().mockResolvedValue({});
  const mockUpdateManifest = jest.fn();

  // Sample args
  const createMockArgs = (overrides: any = {}): any => [
    [{ mode: overrides.mode ?? 'production', platform: overrides.platform ?? 'ios' }],
    { root: overrides.root ?? '/project', ...overrides.configOptions },
    { maxWorkers: 4, resetCache: false, config: 'metro.config.js' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset global
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
      const { ZephyrMetroPlugin } = require('../zephyr-metro-plugin');

      const wrapper = await zephyrCommandWrapper(
        mockBundleFederatedRemote,
        mockLoadMetroConfig,
        mockUpdateManifest
      );

      await wrapper(...createMockArgs({ platform: 'ios' }));

      expect(ZephyrMetroPlugin).toHaveBeenCalledWith(
        expect.objectContaining({
          platform: 'ios',
        })
      );
    });

    it('should pass Android platform to plugin', async () => {
      const { ZephyrMetroPlugin } = require('../zephyr-metro-plugin');

      const wrapper = await zephyrCommandWrapper(
        mockBundleFederatedRemote,
        mockLoadMetroConfig,
        mockUpdateManifest
      );

      await wrapper(...createMockArgs({ platform: 'android' }));

      expect(ZephyrMetroPlugin).toHaveBeenCalledWith(
        expect.objectContaining({
          platform: 'android',
        })
      );
    });
  });

  describe('mode handling', () => {
    it('should set development mode when mode is truthy', async () => {
      const { ZephyrMetroPlugin } = require('../zephyr-metro-plugin');

      const wrapper = await zephyrCommandWrapper(
        mockBundleFederatedRemote,
        mockLoadMetroConfig,
        mockUpdateManifest
      );

      await wrapper(...createMockArgs({ mode: 'development' }));

      expect(ZephyrMetroPlugin).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'development',
        })
      );
    });

    it('should set production mode when mode is falsy', async () => {
      const { ZephyrMetroPlugin } = require('../zephyr-metro-plugin');

      const wrapper = await zephyrCommandWrapper(
        mockBundleFederatedRemote,
        mockLoadMetroConfig,
        mockUpdateManifest
      );

      await wrapper(...createMockArgs({ mode: '' }));

      expect(ZephyrMetroPlugin).toHaveBeenCalledWith(
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
      const { ZephyrMetroPlugin } = require('../zephyr-metro-plugin');

      const wrapper = await zephyrCommandWrapper(
        mockBundleFederatedRemote,
        mockLoadMetroConfig,
        mockUpdateManifest
      );

      await wrapper(...createMockArgs({ root: '/custom/project/path' }));

      expect(ZephyrMetroPlugin).toHaveBeenCalledWith(
        expect.objectContaining({
          context: '/custom/project/path',
        })
      );
    });
  });
});
