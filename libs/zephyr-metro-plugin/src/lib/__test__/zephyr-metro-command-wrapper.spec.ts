import { afterEach, beforeEach, describe, expect, it, rs } from '@rstest/core';

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Unit tests for zephyrCommandWrapper */

const { mockLogZephyrDisabled } = rs.hoisted(() => ({
  mockLogZephyrDisabled: rs.fn(),
}));

// Mock zephyr-agent - must be before imports
rs.mock('zephyr-agent', () => ({
  isZephyrDisabled: () => process.env['ZE_DISABLED'] === 'true',
  logZephyrDisabled: mockLogZephyrDisabled,
  ZephyrError: rs.fn().mockImplementation((error, options) => {
    const err = new Error(options?.message || error);
    (err as any).code = error;
    return err;
  }),
  ZeErrors: {
    ERR_UNKNOWN: 'ERR_UNKNOWN',
    ERR_INVALID_MF_CONFIG: 'ERR_INVALID_MF_CONFIG',
  },
  collectZEPublicVars: rs.fn().mockReturnValue({}),
  ze_log: { app: rs.fn() },
}));

const { mockBeforeBuild, mockAfterBuild, mockBuildFailed, mockApplyToFederationConfig } =
  rs.hoisted(() => ({
    mockBeforeBuild: rs.fn().mockResolvedValue({ name: 'TestApp' }),
    mockAfterBuild: rs.fn().mockResolvedValue(undefined),
    mockBuildFailed: rs.fn(),
    mockApplyToFederationConfig: rs.fn((config?: { plugins?: string[] }) => {
      if (config) config.plugins = [...(config.plugins ?? []), 'seed.js'];
    }),
  }));

// Mock ZephyrMetroPlugin
rs.mock('../zephyr-metro-plugin', () => {
  return {
    ZephyrMetroPlugin: rs.fn().mockImplementation(() => ({
      beforeBuild: mockBeforeBuild,
      afterBuild: mockAfterBuild,
      applyToFederationConfig: mockApplyToFederationConfig,
      zephyr_engine: {
        build_failed: mockBuildFailed,
      },
    })),
  };
});

// Mock internal errors
rs.mock('../internal/metro-errors', () => ({
  ERR_MISSING_METRO_FEDERATION_CONFIG: 'ERR_INVALID_MF_CONFIG',
}));

import { zephyrCommandWrapper } from '../zephyr-metro-command-wrapper';

describe('zephyrCommandWrapper', () => {
  // Mock functions
  const mockBundleFederatedRemote = rs.fn().mockResolvedValue({ success: true });
  const mockLoadMetroConfig = rs.fn().mockResolvedValue({});
  const mockUpdateManifest = rs.fn();

  // Sample args
  const createMockArgs = (overrides: any = {}): any => [
    [{ mode: overrides.mode ?? 'production', platform: overrides.platform ?? 'ios' }],
    { root: overrides.root ?? '/project', ...overrides.configOptions },
    { maxWorkers: 4, resetCache: false, config: 'metro.config.js' },
  ];

  beforeEach(() => {
    rs.clearAllMocks();
    // Reset global
    (global as any).__METRO_FEDERATION_CONFIG = {
      name: 'TestApp',
      remotes: {},
    };
  });

  afterEach(() => {
    delete (global as any).__METRO_FEDERATION_CONFIG;
  });
  it('applies Zephyr overrides to federation options MF rebuilds during bundling', async () => {
    const reloaded = { name: 'TestApp', remotes: {}, plugins: ['core'] };
    let bundledWith: unknown;
    const bundleWithReload = rs.fn(async () => {
      // MF's bundle commands reload function-exported configs and republish options.
      global.__METRO_FEDERATION_CONFIG = reloaded;
      bundledWith = global.__METRO_FEDERATION_CONFIG;
      return { success: true };
    });
    const wrapper = await zephyrCommandWrapper(
      bundleWithReload,
      mockLoadMetroConfig,
      mockUpdateManifest
    );

    await wrapper(...createMockArgs());

    expect(bundledWith).toBe(reloaded);
    expect(reloaded.plugins).toEqual(['core', 'seed.js']);

    // Outside the bundle command the global is a plain value again.
    const later = { name: 'TestApp', remotes: {}, plugins: [] };
    global.__METRO_FEDERATION_CONFIG = later;
    expect(global.__METRO_FEDERATION_CONFIG).toBe(later);
    expect(later.plugins).toEqual([]);
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

    it('rejects tap-app before loading Metro config or bundling', async () => {
      const { ZephyrMetroPlugin } = require('../zephyr-metro-plugin');
      const wrapper = await zephyrCommandWrapper(
        mockBundleFederatedRemote,
        mockLoadMetroConfig,
        mockUpdateManifest
      );

      await expect(wrapper(...createMockArgs({ platform: 'tap-app' }))).rejects.toThrow(
        'Metro cannot publish tap-app artifacts.'
      );

      expect(mockLoadMetroConfig).not.toHaveBeenCalled();
      expect(ZephyrMetroPlugin).not.toHaveBeenCalled();
      expect(mockBundleFederatedRemote).not.toHaveBeenCalled();
    });
  });

  describe('mode handling', () => {
    for (const [dev, expectedMode] of [
      [true, 'development'],
      [false, 'production'],
    ] as const) {
      it(`derives ${expectedMode} mode from dev=${dev}`, async () => {
        const { ZephyrMetroPlugin } = require('../zephyr-metro-plugin');
        const wrapper = await zephyrCommandWrapper(
          mockBundleFederatedRemote,
          mockLoadMetroConfig,
          mockUpdateManifest
        );
        const args = createMockArgs({ configOptions: {}, mode: undefined });
        args[0][0] = { dev, platform: 'ios' };

        await wrapper(...args);

        expect(ZephyrMetroPlugin).toHaveBeenCalledWith(
          expect.objectContaining({ mode: expectedMode })
        );
        expect(mockBundleFederatedRemote).toHaveBeenCalledWith(...args);
      });
    }

    it('keeps RNEF development mode as development', async () => {
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

    it('keeps RNEF production mode as production without changing upstream arguments', async () => {
      const { ZephyrMetroPlugin } = require('../zephyr-metro-plugin');

      const wrapper = await zephyrCommandWrapper(
        mockBundleFederatedRemote,
        mockLoadMetroConfig,
        mockUpdateManifest
      );

      const args = createMockArgs({ mode: 'production' });
      await wrapper(...args);

      expect(ZephyrMetroPlugin).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'production',
        })
      );
      expect(mockBundleFederatedRemote).toHaveBeenCalledWith(...args);
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
      expect(mockBuildFailed).not.toHaveBeenCalled();
    });

    it('should throw ZephyrError when bundle function fails', async () => {
      mockBundleFederatedRemote.mockRejectedValue(new Error('Bundle failed'));

      const wrapper = await zephyrCommandWrapper(
        mockBundleFederatedRemote,
        mockLoadMetroConfig,
        mockUpdateManifest
      );

      await expect(wrapper(...createMockArgs())).rejects.toThrow();
      expect(mockBuildFailed).toHaveBeenCalledTimes(1);
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

  describe('ZE_DISABLED=true', () => {
    beforeEach(() => {
      process.env['ZE_DISABLED'] = 'true';
    });

    afterEach(() => {
      delete process.env['ZE_DISABLED'];
    });

    it('bundles without the Zephyr plugin and says the bundle was not deployed', async () => {
      const { ZephyrMetroPlugin } = require('../zephyr-metro-plugin');
      const wrapper = await zephyrCommandWrapper(
        mockBundleFederatedRemote,
        mockLoadMetroConfig,
        mockUpdateManifest
      );
      const args = createMockArgs();

      const result = await wrapper(...args);

      expect(result).toEqual({ success: true });
      expect(mockLoadMetroConfig).toHaveBeenCalled();
      expect(mockUpdateManifest).toHaveBeenCalled();
      expect(mockBundleFederatedRemote).toHaveBeenCalledWith(...args);
      expect(ZephyrMetroPlugin).not.toHaveBeenCalled();
      expect(mockBeforeBuild).not.toHaveBeenCalled();
      expect(mockAfterBuild).not.toHaveBeenCalled();
      expect(mockLogZephyrDisabled).toHaveBeenCalledTimes(1);
    });

    it('does not say the bundle was built when bundling fails', async () => {
      mockBundleFederatedRemote.mockRejectedValueOnce(new Error('bundle failed'));
      const wrapper = await zephyrCommandWrapper(
        mockBundleFederatedRemote,
        mockLoadMetroConfig,
        mockUpdateManifest
      );

      await expect(wrapper(...createMockArgs())).rejects.toThrow('bundle failed');
      expect(mockLogZephyrDisabled).not.toHaveBeenCalled();
    });

    it('still rejects an unsupported platform first', async () => {
      const wrapper = await zephyrCommandWrapper(
        mockBundleFederatedRemote,
        mockLoadMetroConfig,
        mockUpdateManifest
      );

      await expect(wrapper(...createMockArgs({ platform: 'tap-app' }))).rejects.toThrow();
      expect(mockLoadMetroConfig).not.toHaveBeenCalled();
    });
  });
});
