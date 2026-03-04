import { rs } from '@rstest/core';
import { ZephyrMetroPlugin } from '../zephyr-metro-plugin';

const zeLogConfigMock = rs.fn();
const zeLogAppMock = rs.fn();
const zeLogErrorMock = rs.fn();
const zeLogManifestMock = rs.fn();
const zephyrEngineCreateMock = rs.fn();
const buildAssetsMapMock = rs.fn().mockReturnValue({});

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
  buildAssetsMap: (...args: unknown[]) => buildAssetsMapMock(...args),
}));

const extractRemotesDependenciesMock = rs.fn().mockReturnValue([
  { name: 'RemoteApp', version: 'latest' },
]);
const mutateMfConfigMock = rs.fn();
const createMinimalBuildStatsMock = rs.fn().mockResolvedValue({
  id: 'test-build-id',
  timestamp: Date.now(),
});
const resolveCatalogDependenciesMock = rs.fn().mockReturnValue({});
const extractModulesFromExposesMock = rs.fn().mockReturnValue([]);
const getPackageDependenciesMock = rs.fn().mockReturnValue([]);
const parseSharedDependenciesMock = rs.fn().mockReturnValue({});
const loadStaticEntriesMock = rs.fn().mockResolvedValue([]);

rs.mock('../internal/extract-mf-remotes', () => ({
  extract_remotes_dependencies: (...args: unknown[]) => extractRemotesDependenciesMock(...args),
}));

rs.mock('../internal/mutate-mf-config', () => ({
  mutateMfConfig: (...args: unknown[]) => mutateMfConfigMock(...args),
}));

rs.mock('../internal/metro-build-stats', () => ({
  createMinimalBuildStats: (...args: unknown[]) => createMinimalBuildStatsMock(...args),
  resolveCatalogDependencies: (...args: unknown[]) => resolveCatalogDependenciesMock(...args),
}));

rs.mock('../internal/extract-modules-from-exposes', () => ({
  extractModulesFromExposes: (...args: unknown[]) => extractModulesFromExposesMock(...args),
}));

rs.mock('../internal/get-package-dependencies', () => ({
  getPackageDependencies: (...args: unknown[]) => getPackageDependenciesMock(...args),
}));

rs.mock('../internal/parse-shared-dependencies', () => ({
  parseSharedDependencies: (...args: unknown[]) => parseSharedDependenciesMock(...args),
}));

rs.mock('../internal/load-static-entries', () => ({
  load_static_entries: (...args: unknown[]) => loadStaticEntriesMock(...args),
}));

function createEngineMock() {
  return {
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
    start_new_build: rs.fn().mockResolvedValue(undefined),
    upload_assets: rs.fn().mockResolvedValue(undefined),
    build_finished: rs.fn().mockResolvedValue(undefined),
  };
}

describe('ZephyrMetroPlugin', () => {
  beforeEach(() => {
    rs.clearAllMocks();
    zephyrEngineCreateMock.mockResolvedValue(createEngineMock());
    buildAssetsMapMock.mockReturnValue({});
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

      expect(zephyrEngineCreateMock).toHaveBeenCalledWith({
        builder: 'metro',
        context: '/project',
      });
    });

    it('should resolve remote dependencies', async () => {
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

      expect(zephyrEngineCreateMock).toHaveBeenCalled();
      expect(extractRemotesDependenciesMock).toHaveBeenCalled();
    });

    it('should mutate MF config when provided', async () => {
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

      expect(mutateMfConfigMock).toHaveBeenCalled();
    });

    it('should not mutate MF config when not provided', async () => {
      const plugin = new ZephyrMetroPlugin({
        platform: 'ios',
        mode: 'development',
        context: '/project',
        outDir: 'dist',
        mfConfig: undefined,
      });

      await plugin.beforeBuild();

      expect(mutateMfConfigMock).not.toHaveBeenCalled();
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
      const plugin = new ZephyrMetroPlugin({
        platform: 'ios',
        mode: 'development',
        context: '/project',
        outDir: 'dist',
        mfConfig: undefined,
      });

      await plugin.beforeBuild();

      expect(zeLogConfigMock).toHaveBeenCalled();
    });
  });

  describe('afterBuild', () => {
    it('should complete build lifecycle', async () => {
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

      expect(zephyrEngineCreateMock).toHaveBeenCalled();
      expect(buildAssetsMapMock).toHaveBeenCalled();
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
      const plugin = new ZephyrMetroPlugin({
        platform: 'ios',
        mode: 'development',
        context: '/custom/project/path',
        outDir: 'dist',
        mfConfig: undefined,
      });

      await plugin.beforeBuild();

      expect(zephyrEngineCreateMock).toHaveBeenCalledWith({
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
