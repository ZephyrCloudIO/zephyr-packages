import { beforeEach, describe, expect, it, rs } from '@rstest/core';
import type { Mock } from '@rstest/core';

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
  });

  describe('beforeBuild', () => {
    it('should initialize ZephyrEngine with metro builder', async () => {
      const { ZephyrEngine } = require('zephyr-agent');

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
      const { ZephyrEngine } = require('zephyr-agent');

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
      const { ze_log } = require('zephyr-agent');

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
    it('should complete build lifecycle', async () => {
      const { ZephyrEngine } = require('zephyr-agent');

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
      const { ZephyrEngine } = require('zephyr-agent');

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
