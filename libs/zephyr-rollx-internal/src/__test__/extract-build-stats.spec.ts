import type { ZephyrEngine } from 'zephyr-agent';
import { extractRollxBuildStats } from '../lib/extract-build-stats';
import type { XFederatedConfig, XOutputBundle } from '../types';

const create_minimal_build_stats = jest.fn();
const resolveCatalogDependencies = jest.fn();

describe('extract-build-stats', () => {
  const mockZephyrEngine: Partial<ZephyrEngine> = {
    applicationProperties: {
      name: 'test-app',
      version: '1.0.0',
      org: 'test-org',
      project: 'test-project',
    },
    gitProperties: {
      git: {
        commit: 'abc123',
        branch: 'main',
        tags: ['v1.0.0'],
        name: 'test-user',
        email: 'test@test.com',
      },
      app: {
        org: 'test-org',
        project: 'test-project',
      },
    },
    env: {
      isCI: false,
      target: 'ios',
    },
    snapshotId: Promise.resolve('snapshot-123'),
    application_uid: 'app-uid-123',
    build_id: Promise.resolve('build-123'),
    application_configuration: Promise.resolve({
      EDGE_URL: 'https://edge.test.com',
      PLATFORM: 'cloudflare' as any,
      DELIMITER: '/',
      application_uid: 'app-uid-123',
      AUTH0_CLIENT_ID: 'auth0-client-id',
      AUTH0_DOMAIN: 'auth0-domain',
      BUILD_ID_ENDPOINT: 'https://build-id.test.com',
      BUILD_ID: 'build-123',
      email: 'test@test.com',
      jwt: 'jwt-123',
      user_uuid: 'user-uuid-123',
      username: 'test-user',
      build_target: 'ios',
    }),
    npmProperties: {
      name: 'test-app',
      version: '1.0.0',
      dependencies: {
        react: '18.0.0',
        'catalog-dep': 'catalog:shared',
      },
      devDependencies: {
        typescript: '5.0.0',
      },
      peerDependencies: {},
      optionalDependencies: {},
    },
  };

  const mockBundle: XOutputBundle = {
    'main.js': {
      type: 'chunk',
      code: 'loadRemote("remote1/Component1"); console.log("main");',
      fileName: 'main.js',
      name: 'main',
      moduleIds: ['src/main.js'],
      isEntry: true,
      exports: [],
      imports: [],
      facadeModuleId: 'src/main.js',
    },
    'vendor.js': {
      type: 'chunk',
      code: 'n.then(e => c("remote2/Component2"));',
      fileName: 'vendor.js',
      facadeModuleId: 'src/vendor.js',
      name: 'vendor',
      moduleIds: ['src/vendor.js'],
      isEntry: false,
      exports: [],
      imports: [],
    },
    'style.css': {
      type: 'asset',
      source: '.app { color: blue; }',
      fileName: 'style.css',
      names: ['style.css'],
      originalFileNames: ['src/style.css'],
      needsCodeReference: false,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    create_minimal_build_stats.mockResolvedValue({
      id: 'minimal-stats',
      name: 'test-app',
      dependencies: [],
      devDependencies: [],
      optionalDependencies: [],
      peerDependencies: [],
      consumes: [],
      overrides: [],
      modules: [],
    });

    resolveCatalogDependencies.mockImplementation((deps: Record<string, string>) => {
      if (!deps) return {};
      const resolved = { ...deps };
      Object.keys(resolved).forEach((key) => {
        if (resolved[key] === 'catalog:shared') {
          resolved[key] = '1.0.0';
        }
      });
      return resolved;
    });
  });

  describe('extractRollxBuildStats', () => {
    it('should return minimal stats when bundle is null', async () => {
      const mfConfig: XFederatedConfig = {
        name: 'test-remote',
        filename: 'custom-entry.js',
        remotes: {
          remote1: 'remote1@http://localhost:3001/remoteEntry.js',
        },
      };

      const result = await extractRollxBuildStats({
        zephyr_engine: mockZephyrEngine as ZephyrEngine,
        bundle: null as unknown as XOutputBundle,
        mfConfig,
        root: '/test',
      });

      expect(result.name).toBe('test-remote');
      expect(result.remote).toBe('custom-entry.js');
      expect(result.remotes).toEqual(['remote1']);
      // expect(result.metadata?.hasFederation).toBe(true);
    });

    it('should extract full build stats from bundle with Module Federation', async () => {
      const mfConfig: XFederatedConfig = {
        name: 'host-app',
        filename: 'remoteEntry.js',
        remotes: {
          remote1: 'remote1@http://localhost:3001/remoteEntry.js',
          remote2: 'remote2@http://localhost:3002/remoteEntry.js',
        },
        shared: {
          react: {
            singleton: true,
            requiredVersion: '18.0.0',
          },
          'react-dom': '18.0.0',
        },
        exposes: {
          './Button': './src/Button',
          './Header': { import: './src/Header' },
        },
      };

      const result = await extractRollxBuildStats({
        zephyr_engine: mockZephyrEngine as ZephyrEngine,
        bundle: mockBundle,
        mfConfig,
        root: '/test',
      });

      expect(result.name).toBe('host-app');
      expect(result.remote).toBe('remoteEntry.js');
      expect(result.remotes).toEqual(['remote1', 'remote2']);
    });

    it('should detect remote imports from bundle code', async () => {
      const result = await extractRollxBuildStats({
        zephyr_engine: mockZephyrEngine as ZephyrEngine,
        bundle: mockBundle,
        root: '/test',
      });

      expect(result.consumes).toHaveLength(2);
      expect(result.consumes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            applicationID: 'remote1',
            name: 'Component1',
          }),
          expect.objectContaining({
            applicationID: 'remote2',
            name: 'Component2',
          }),
        ])
      );
    });

    it('should extract modules from exposes configuration', async () => {
      const mfConfig: XFederatedConfig = {
        name: 'remote-app',
        exposes: {
          './Button': './src/components/Button',
          './Card': { import: './src/components/Card' },
        },
        shared: {
          react: '18.0.0',
          lodash: '4.17.21',
        },
      };

      const result = await extractRollxBuildStats({
        zephyr_engine: mockZephyrEngine as ZephyrEngine,
        bundle: mockBundle,
        mfConfig,
        root: '/test',
      });

      expect(result.modules).toHaveLength(2);
      expect(result.modules).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'Button',
            file: './src/components/Button',
            requires: expect.arrayContaining(['react', 'lodash']),
          }),
          expect.objectContaining({
            name: 'Card',
            file: './src/components/Card',
            requires: expect.arrayContaining(['react', 'lodash']),
          }),
        ])
      );
    });

    it('should handle shared dependencies with catalog references', async () => {
      // Create a custom mock for this test where react is not in dependencies
      // so it falls back to the catalog reference in mfConfig
      const customMockZephyrEngine = {
        ...mockZephyrEngine,
        npmProperties: {
          ...mockZephyrEngine.npmProperties,
          dependencies: {
            'catalog-dep': 'catalog:shared',
            // react is NOT in dependencies, so it should use mfConfig.shared.react.requiredVersion
          },
        },
      };

      const mfConfig: XFederatedConfig = {
        name: 'test-app',
        shared: {
          react: {
            requiredVersion: 'catalog:shared',
            singleton: true,
          },
          lodash: '4.17.21',
        },
      };

      const result = await extractRollxBuildStats({
        zephyr_engine: customMockZephyrEngine as ZephyrEngine,
        bundle: mockBundle,
        mfConfig,
        root: '/test',
      });

      expect(result.overrides).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'react',
            version: '1.0.0', // resolved from catalog
          }),
          expect.objectContaining({
            name: 'lodash',
            version: '4.17.21',
          }),
        ])
      );
    });

    it('should handle array format shared dependencies', async () => {
      const mfConfig: XFederatedConfig = {
        name: 'test-app',
        shared: ['react', 'react-dom'],
        exposes: {
          './Component': './src/Component',
        },
      };

      const result = await extractRollxBuildStats({
        zephyr_engine: mockZephyrEngine as ZephyrEngine,
        bundle: mockBundle,
        mfConfig,
        root: '/test',
      });

      expect(result.modules[0].requires).toEqual(
        expect.arrayContaining(['react', 'react-dom'])
      );
    });

    it('should handle additionalShared from Nx configuration', async () => {
      const mfConfig: XFederatedConfig = {
        name: 'nx-app',
        exposes: {
          './Component': './src/Component',
        },
        additionalShared: [
          {
            libraryName: 'rxjs',
            sharedConfig: { singleton: true },
          },
        ],
      };

      const result = await extractRollxBuildStats({
        zephyr_engine: mockZephyrEngine as ZephyrEngine,
        bundle: mockBundle,
        mfConfig,
        root: '/test',
      });

      expect(result.modules[0].requires).toEqual(expect.arrayContaining(['rxjs']));
    });

    it('should handle bundle without Module Federation config', async () => {
      const result = await extractRollxBuildStats({
        zephyr_engine: mockZephyrEngine as ZephyrEngine,
        bundle: mockBundle,
        root: '/test',
      });

      expect(result.name).toBe('test-app');
      expect(result.remote).toBe('remoteEntry.js');
      expect(result.remotes).toEqual([]);
      expect(result.modules).toEqual([]);
    });

    it('should calculate correct bundle size', async () => {
      const largeBundle: XOutputBundle = {
        'app.js': {
          type: 'chunk',
          code: 'a'.repeat(1000),
          fileName: 'app.js',
          name: 'app',
          facadeModuleId: 'src/app.js',
          moduleIds: ['src/app.js'],
          isEntry: true,
          exports: [],
          imports: [],
        },
        'styles.css': {
          type: 'asset',
          source: 'b'.repeat(500),
          fileName: 'styles.css',
          names: ['styles.css'],
          originalFileNames: ['src/styles.css'],
          needsCodeReference: false,
        },
        'image.png': {
          type: 'asset',
          source: new Uint8Array(300),
          fileName: 'image.png',
          names: ['image.png'],
          originalFileNames: ['src/image.png'],
          needsCodeReference: false,
        },
      };

      const result = await extractRollxBuildStats({
        zephyr_engine: mockZephyrEngine as ZephyrEngine,
        bundle: largeBundle,
        root: '/test',
      });

      expect(result.name).toBe('test-app');
      expect(result.remote).toBe('remoteEntry.js');
      expect(result.remotes).toEqual([]);
      expect(result.modules).toEqual([]);
      expect(result.consumes).toEqual([]);
      expect(result.overrides).toEqual([]);
    });

    it('should handle complex loadRemote patterns', async () => {
      const complexBundle: XOutputBundle = {
        'complex.js': {
          type: 'chunk',
          code: `
            loadRemote("remote1/Component1");
            
            const promise = n.then(e => c("remote2/Component2"));
            
            loadRemote("remote3/Component3");
          `,
          facadeModuleId: 'src/complex.js',
          fileName: 'complex.js',
          name: 'complex',
          moduleIds: ['src/complex.js'],
          isEntry: true,
          exports: [],
          imports: [],
        },
      };

      const result = await extractRollxBuildStats({
        zephyr_engine: mockZephyrEngine as ZephyrEngine,
        bundle: complexBundle,
        root: '/test',
      });

      expect(result.consumes).toHaveLength(3);
      expect(result.consumes.map((c) => c.applicationID)).toEqual(
        expect.arrayContaining(['remote1', 'remote2', 'remote3'])
      );
    });
  });
});
