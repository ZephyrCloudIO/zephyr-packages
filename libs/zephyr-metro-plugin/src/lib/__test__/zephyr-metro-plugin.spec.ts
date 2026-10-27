import * as path from 'node:path';
import { beforeEach, describe, expect, it, rs } from '@rstest/core';
import type { Mock } from '@rstest/core';
import * as actualNativeInternal from 'zephyr-native-internal' with {
  rstest: 'importActual',
};
const writeEnvPlugin = rs.hoisted(() =>
  rs.fn().mockReturnValue('/project/node_modules/.zephyr-metro/env-plugin-abc.js')
);
/** Unit tests for ZephyrMetroPlugin class */

// Mock zephyr-agent - must be before imports
rs.mock('zephyr-agent', () => ({
  ze_log: {
    config: rs.fn(),
    app: rs.fn(),
    error: rs.fn(),
    manifest: rs.fn(),
  },
  ZephyrEngine: {
    create: rs.fn().mockResolvedValue({
      env: { target: 'ios' as const },
      applicationProperties: { name: 'TestApp' },
      application_uid: 'test-app-uid',
      npmProperties: {
        dependencies: { react: '^18.0.0' },
        devDependencies: { typescript: '^5.0.0' },
        optionalDependencies: {},
        peerDependencies: {},
      },
      resolve_remote_dependencies: rs.fn().mockResolvedValue([
        {
          name: 'RemoteApp',
          version: 'latest',
          application_uid: 'remote-app.project.org',
          resolved_url: 'http://cdn.example.com/remote.js',
        },
      ]),
      build_id: Promise.resolve('build-id'),
      start_new_build: rs.fn().mockResolvedValue(undefined),
      upload_assets: rs.fn().mockResolvedValue(undefined),
      build_finished: rs.fn().mockResolvedValue(undefined),
      build_failed: rs.fn(),
    }),
  },
  buildAssetsMap: rs.fn().mockReturnValue({}),
  resolveMfManifestPath: rs.fn().mockReturnValue('mf-manifest.json'),
}));

rs.mock('zephyr-native-internal', () => ({
  ...actualNativeInternal,
  writeNativeEnvRuntimePlugin: writeEnvPlugin,
}));

// Mock internal dependencies
rs.mock('../internal/extract-mf-remotes', () => ({
  extract_remotes_dependencies: rs
    .fn()
    .mockReturnValue([{ name: 'RemoteApp', version: 'latest' }]),
}));

rs.mock('../internal/mutate-mf-config', () => ({
  mutateMfConfig: rs.fn(),
}));

rs.mock('../internal/metro-build-stats', () => ({
  createMinimalBuildStats: rs.fn().mockResolvedValue({
    id: 'test-build-id',
    timestamp: Date.now(),
  }),
  resolveCatalogDependencies: rs.fn().mockReturnValue({}),
}));

rs.mock('../internal/extract-modules-from-exposes', () => ({
  extractModulesFromExposes: rs.fn().mockReturnValue([]),
}));

rs.mock('../internal/get-package-dependencies', () => ({
  getPackageDependencies: rs.fn().mockReturnValue([]),
}));

rs.mock('../internal/parse-shared-dependencies', () => ({
  parseSharedDependencies: rs.fn().mockReturnValue({}),
}));

rs.mock('../internal/load-static-entries', () => ({
  load_static_entries: rs.fn().mockResolvedValue([]),
}));

import { ZephyrMetroPlugin } from '../zephyr-metro-plugin';

describe('ZephyrMetroPlugin', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create instance with valid config', () => {
      const plugin = new ZephyrMetroPlugin({
        platform: 'ios',
        mode: 'development',
        context: '/project',
        outDir: 'dist',
        mfConfig: {
          name: 'TestApp',
          remotes: {},
        },
      });

      expect(plugin).toBeInstanceOf(ZephyrMetroPlugin);
    });

    it('should accept android platform', () => {
      const plugin = new ZephyrMetroPlugin({
        platform: 'android',
        mode: 'production',
        context: '/project',
        outDir: 'dist',
        mfConfig: undefined,
      });

      expect(plugin).toBeInstanceOf(ZephyrMetroPlugin);
    });

    it('rejects tap-app from untyped callers before creating an engine', async () => {
      const { ZephyrEngine } = await import('zephyr-agent');

      expect(
        () =>
          new ZephyrMetroPlugin({
            platform: 'tap-app' as never,
            mode: 'production',
            context: '/project',
            outDir: 'dist',
            mfConfig: undefined,
          })
      ).toThrow('Metro cannot publish tap-app artifacts.');
      expect(ZephyrEngine.create).not.toHaveBeenCalled();
    });
  });

  describe('beforeBuild', () => {
    it('registers resolved remote UIDs as a runtime plugin', async () => {
      const { writeNativeEnvRuntimePlugin } = await import('zephyr-native-internal');
      const mfConfig = {
        name: 'TestApp',
        remotes: {},
        plugins: ['core'],
      } as never;
      const plugin = new ZephyrMetroPlugin({
        platform: 'ios',
        mode: 'development',
        context: '/project',
        outDir: 'dist',
        mfConfig,
      });

      await plugin.beforeBuild();

      expect(writeNativeEnvRuntimePlugin).toHaveBeenCalledWith(
        path.join('/project', 'node_modules', '.zephyr-metro'),
        [
          expect.objectContaining({
            name: 'RemoteApp',
            application_uid: 'remote-app.project.org',
          }),
        ]
      );
      expect((mfConfig as { plugins: string[] }).plugins).toEqual([
        'core',
        '/project/node_modules/.zephyr-metro/env-plugin-abc.js',
      ]);
    });
    it('adds no env plugin when no remote resolves', async () => {
      const { ZephyrEngine } = await import('zephyr-agent');
      const engine = await ZephyrEngine.create({
        builder: 'metro',
        context: '/project',
      } as never);
      (engine.resolve_remote_dependencies as Mock).mockResolvedValueOnce([]);
      writeEnvPlugin.mockReturnValueOnce(undefined);
      const mfConfig = { name: 'TestApp', remotes: {}, plugins: ['core'] };
      const plugin = new ZephyrMetroPlugin({
        platform: 'ios',
        mode: 'development',
        context: '/project',
        outDir: 'dist',
        mfConfig,
      });

      await plugin.beforeBuild();

      expect(mfConfig.plugins).toEqual(['core']);
    });

    it('reapplies rewritten remotes and the env plugin to rebuilt federation options', async () => {
      const { mutateMfConfig } = require('../internal/mutate-mf-config');
      (mutateMfConfig as Mock).mockImplementationOnce(
        (_engine: unknown, config: { remotes: Record<string, string> }) => {
          config.remotes.RemoteApp = 'RemoteApp@https://edge.example/mf-manifest.json';
        }
      );
      const plugin = new ZephyrMetroPlugin({
        platform: 'ios',
        mode: 'production',
        context: '/project',
        outDir: 'dist',
        mfConfig: {
          name: 'TestApp',
          remotes: { RemoteApp: 'RemoteApp@http://localhost:9000/mf-manifest.json' },
        },
      });
      await plugin.beforeBuild();

      const rebuilt = {
        remotes: {
          RemoteApp: 'RemoteApp@http://localhost:9000/mf-manifest.json',
          Other: 'Other@http://localhost:9001/mf-manifest.json',
        },
        plugins: ['core'],
      };
      plugin.applyToFederationConfig(rebuilt);
      plugin.applyToFederationConfig(rebuilt);

      expect(rebuilt).toEqual({
        remotes: {
          RemoteApp: 'RemoteApp@https://edge.example/mf-manifest.json',
          Other: 'Other@http://localhost:9001/mf-manifest.json',
        },
        plugins: ['core', '/project/node_modules/.zephyr-metro/env-plugin-abc.js'],
      });
    });

    it('should initialize ZephyrEngine with metro builder', async () => {
      const { ZephyrEngine } = await import('zephyr-agent');

      const plugin = new ZephyrMetroPlugin({
        platform: 'ios',
        mode: 'development',
        context: '/project',
        outDir: 'dist',
        mfConfig: {
          name: 'TestApp',
          remotes: { RemoteApp: 'http://localhost:9000/remote.js' },
        },
      });

      await plugin.beforeBuild();

      expect(ZephyrEngine.create).toHaveBeenCalledWith({
        builder: 'metro',
        context: '/project',
      });
    });

    it('should resolve remote dependencies', async () => {
      const { ZephyrEngine } = await import('zephyr-agent');

      const plugin = new ZephyrMetroPlugin({
        platform: 'ios',
        mode: 'development',
        context: '/project',
        outDir: 'dist',
        mfConfig: {
          name: 'TestApp',
          remotes: { RemoteApp: 'http://localhost:9000/remote.js' },
        },
      });

      await plugin.beforeBuild();

      // Engine should have been created
      expect(ZephyrEngine.create).toHaveBeenCalled();
    });

    it('should mutate MF config when provided', async () => {
      const { mutateMfConfig } = require('../internal/mutate-mf-config');

      const mfConfig = {
        name: 'TestApp',
        remotes: { RemoteApp: 'http://localhost:9000/remote.js' },
      };

      const plugin = new ZephyrMetroPlugin({
        platform: 'ios',
        mode: 'development',
        context: '/project',
        outDir: 'dist',
        mfConfig,
      });

      await plugin.beforeBuild();

      expect(mutateMfConfig).toHaveBeenCalled();
    });

    it('should not mutate MF config when not provided', async () => {
      const { mutateMfConfig } = require('../internal/mutate-mf-config');

      const plugin = new ZephyrMetroPlugin({
        platform: 'ios',
        mode: 'development',
        context: '/project',
        outDir: 'dist',
        mfConfig: undefined,
      });

      await plugin.beforeBuild();

      expect(mutateMfConfig).not.toHaveBeenCalled();
    });

    it('should return mfConfig from beforeBuild', async () => {
      const mfConfig = {
        name: 'TestApp',
        remotes: {},
      };

      const plugin = new ZephyrMetroPlugin({
        platform: 'ios',
        mode: 'development',
        context: '/project',
        outDir: 'dist',
        mfConfig,
      });

      const result = await plugin.beforeBuild();

      expect(result).toBe(mfConfig);
    });

    it('should log configuration', async () => {
      const { ze_log } = await import('zephyr-agent');

      const plugin = new ZephyrMetroPlugin({
        platform: 'ios',
        mode: 'development',
        context: '/project',
        outDir: 'dist',
        mfConfig: undefined,
      });

      await plugin.beforeBuild();

      expect(ze_log.config).toHaveBeenCalled();
    });
  });

  describe('afterBuild', () => {
    it('rejects a tap-app engine mutation before publishing assets', async () => {
      const plugin = new ZephyrMetroPlugin({
        platform: 'ios',
        mode: 'production',
        context: '/project',
        outDir: 'dist',
        mfConfig: undefined,
      });
      await plugin.beforeBuild();
      plugin.zephyr_engine.env.target = 'tap-app' as never;

      await expect(plugin.afterBuild()).rejects.toThrow(
        'Metro cannot publish tap-app artifacts.'
      );
      expect(plugin.zephyr_engine.upload_assets).not.toHaveBeenCalled();
      expect(plugin.zephyr_engine.build_failed).toHaveBeenCalledTimes(1);
    });

    it('should complete build lifecycle', async () => {
      const { ZephyrEngine } = await import('zephyr-agent');

      const plugin = new ZephyrMetroPlugin({
        platform: 'ios',
        mode: 'production',
        context: '/project',
        outDir: 'dist',
        mfConfig: {
          name: 'TestApp',
          remotes: {},
        },
      });

      await plugin.beforeBuild();
      await plugin.afterBuild();

      // The plugin should have called engine methods
      expect(ZephyrEngine.create).toHaveBeenCalled();
    });

    it('rolls back a failed upload and allows a fresh afterBuild retry', async () => {
      const plugin = new ZephyrMetroPlugin({
        platform: 'ios',
        mode: 'production',
        context: '/project',
        outDir: 'dist',
        mfConfig: { name: 'TestApp', remotes: {} },
      });
      await plugin.beforeBuild();
      const engine = plugin.zephyr_engine;
      const uploadFailure = new Error('upload failed');
      (engine.upload_assets as Mock)
        .mockRejectedValueOnce(uploadFailure)
        .mockResolvedValueOnce(undefined);

      await expect(plugin.afterBuild()).rejects.toBe(uploadFailure);
      await expect(plugin.afterBuild()).resolves.toBeUndefined();

      expect(engine.build_failed).toHaveBeenCalledTimes(1);
      expect(engine.start_new_build).toHaveBeenCalledTimes(2);
      expect(engine.build_finished).toHaveBeenCalledTimes(1);
    });
  });

  describe('mode handling', () => {
    it('should accept development mode', () => {
      const plugin = new ZephyrMetroPlugin({
        platform: 'ios',
        mode: 'development',
        context: '/project',
        outDir: 'dist',
        mfConfig: undefined,
      });

      expect(plugin).toBeInstanceOf(ZephyrMetroPlugin);
    });

    it('should accept production mode', () => {
      const plugin = new ZephyrMetroPlugin({
        platform: 'ios',
        mode: 'production',
        context: '/project',
        outDir: 'dist',
        mfConfig: undefined,
      });

      expect(plugin).toBeInstanceOf(ZephyrMetroPlugin);
    });
  });

  describe('context handling', () => {
    it('should use provided context path', async () => {
      const { ZephyrEngine } = await import('zephyr-agent');

      const plugin = new ZephyrMetroPlugin({
        platform: 'ios',
        mode: 'development',
        context: '/custom/project/path',
        outDir: 'dist',
        mfConfig: undefined,
      });

      await plugin.beforeBuild();

      expect(ZephyrEngine.create).toHaveBeenCalledWith({
        builder: 'metro',
        context: '/custom/project/path',
      });
    });
  });

  describe('outDir handling', () => {
    it('should accept custom outDir', () => {
      const plugin = new ZephyrMetroPlugin({
        platform: 'ios',
        mode: 'production',
        context: '/project',
        outDir: 'build/output',
        mfConfig: undefined,
      });

      expect(plugin).toBeInstanceOf(ZephyrMetroPlugin);
    });
  });
});
