import type {
  XFederatedSharedConfig,
  XAdditionalSharedConfig,
  XFederatedConfig,
  ModuleFederationPlugin,
  XOutputAsset,
  XOutputChunk,
  XOutputBundle,
  XPreRenderdAsset,
  XPreRenderedChunk,
} from '../types/index';

describe('types/index', () => {
  describe('XFederatedSharedConfig', () => {
    it('should allow valid shared config properties', () => {
      const validConfigs: XFederatedSharedConfig[] = [
        {
          singleton: true,
          requiredVersion: '18.0.0',
          version: '18.2.0',
          eager: false,
        },
        {
          singleton: false,
        },
        {
          requiredVersion: '^17.0.0',
          libraryName: 'react',
        },
        {},
      ];

      validConfigs.forEach((config) => {
        expect(config).toBeDefined();
        if (config.singleton !== undefined) {
          expect(typeof config.singleton).toBe('boolean');
        }
        if (config.requiredVersion !== undefined) {
          expect(typeof config.requiredVersion).toBe('string');
        }
        if (config.version !== undefined) {
          expect(typeof config.version).toBe('string');
        }
        if (config.eager !== undefined) {
          expect(typeof config.eager).toBe('boolean');
        }
        if (config.libraryName !== undefined) {
          expect(typeof config.libraryName).toBe('string');
        }
      });
    });
  });

  describe('XAdditionalSharedConfig', () => {
    it('should require libraryName and allow optional sharedConfig', () => {
      const validConfigs: XAdditionalSharedConfig[] = [
        {
          libraryName: 'react',
        },
        {
          libraryName: 'lodash',
          sharedConfig: {
            singleton: true,
            requiredVersion: '^4.0.0',
          },
        },
      ];

      validConfigs.forEach((config) => {
        expect(config.libraryName).toBeDefined();
        expect(typeof config.libraryName).toBe('string');

        if (config.sharedConfig) {
          expect(typeof config.sharedConfig).toBe('object');
        }
      });
    });
  });

  describe('XFederatedConfig', () => {
    it('should allow various federated configurations', () => {
      const configs: XFederatedConfig[] = [
        {
          name: 'host-app',
        },
        {
          name: 'remote-app',
          filename: 'remoteEntry.js',
          exposes: {
            './Button': './src/Button',
            './Header': { import: './src/Header' },
          },
        },
        {
          name: 'consumer-app',
          remotes: {
            remoteApp: 'remoteApp@http://localhost:3001/remoteEntry.js',
          },
          shared: {
            react: '18.0.0',
            'react-dom': {
              singleton: true,
              requiredVersion: '18.0.0',
            },
          },
        },
        {
          name: 'nx-app',
          shared: ['react', 'react-dom'],
          additionalShared: [
            {
              libraryName: 'rxjs',
              sharedConfig: { singleton: true },
            },
          ],
        },
      ];

      configs.forEach((config) => {
        expect(config.name).toBeDefined();
        expect(typeof config.name).toBe('string');
      });
    });

    it('should handle different remote configurations', () => {
      const config: XFederatedConfig = {
        name: 'test-app',
        remotes: {
          stringRemote: 'remote@http://localhost:3001/remoteEntry.js',
          objectRemote: {
            external: 'http://localhost:3002/remoteEntry.js',
            shareScope: 'default',
          },
          arrayRemote: ['remote1', 'remote2'],
        },
      };

      expect(config.remotes).toBeDefined();
      expect(typeof config.remotes).toBe('object');
    });
  });

  describe('ModuleFederationPlugin', () => {
    it('should define plugin interface correctly', () => {
      const mockCompiler = {};

      const plugin: ModuleFederationPlugin = {
        apply: (compiler: unknown) => {
          expect(compiler).toBe(mockCompiler);
        },
        _options: {
          name: 'test-app',
          shared: { react: '18.0.0' },
        },
        config: {
          name: 'repack-app',
          bundle_name: 'main.bundle.js',
        },
      };

      expect(typeof plugin.apply).toBe('function');
      plugin.apply(mockCompiler);
    });
  });

  describe('XOutputAsset', () => {
    it('should extend XPreRenderdAsset with additional properties', () => {
      const asset: XOutputAsset = {
        type: 'asset',
        fileName: 'style.css',
        needsCodeReference: false,
        names: ['style.css'],
        originalFileNames: ['src/style.css'],
        source: '.app { color: blue; }',
      };

      expect(asset.type).toBe('asset');
      expect(asset.fileName).toBe('style.css');
      expect(asset.needsCodeReference).toBe(false);
      expect(asset.names).toEqual(['style.css']);
      expect(asset.originalFileNames).toEqual(['src/style.css']);
      expect(asset.source).toBe('.app { color: blue; }');
    });

    it('should handle Uint8Array source', () => {
      const binaryData = new TextEncoder().encode('binary content');
      const asset: XOutputAsset = {
        type: 'asset',
        fileName: 'image.png',
        needsCodeReference: false,
        names: ['image.png'],
        originalFileNames: ['src/assets/image.png'],
        source: binaryData,
      };

      expect(asset.source).toBeInstanceOf(Uint8Array);
      expect(new TextDecoder().decode(asset.source as Uint8Array)).toBe('binary content');
    });
  });

  describe('XOutputChunk', () => {
    it('should extend XPreRenderedChunk with chunk-specific properties', () => {
      const chunk: XOutputChunk = {
        type: 'chunk',
        code: 'console.log("hello");',
        fileName: 'main.js',
        name: 'main',
        moduleIds: ['src/main.js', 'src/utils.js'],
        isEntry: true,
        exports: ['default'],
        imports: ['react'],
      };

      expect(chunk.type).toBe('chunk');
      expect(chunk.code).toBe('console.log("hello");');
      expect(chunk.fileName).toBe('main.js');
      expect(chunk.name).toBe('main');
      expect(chunk.moduleIds).toEqual(['src/main.js', 'src/utils.js']);
      expect(chunk.isEntry).toBe(true);
      expect(chunk.exports).toEqual(['default']);
      expect(chunk.imports).toEqual(['react']);
    });

    it('should allow optional properties', () => {
      const minimalChunk: XOutputChunk = {
        type: 'chunk',
        code: 'export {};',
        fileName: 'empty.js',
        name: 'empty',
        moduleIds: [],
        isEntry: false,
        exports: [],
        imports: [],
      };

      expect(minimalChunk.source).toBeUndefined();
      expect(minimalChunk.sourcemap).toBeUndefined();
      expect(minimalChunk.file).toBeUndefined();
    });
  });

  describe('XOutputBundle', () => {
    it('should handle mixed bundle with assets and chunks', () => {
      const bundle: XOutputBundle = {
        'main.js': {
          type: 'chunk',
          code: 'console.log("main");',
          fileName: 'main.js',
          name: 'main',
          moduleIds: ['src/main.js'],
          isEntry: true,
          exports: [],
          imports: [],
        },
        'style.css': {
          type: 'asset',
          source: '.main { color: red; }',
          fileName: 'style.css',
          names: ['style.css'],
          originalFileNames: ['src/style.css'],
          needsCodeReference: false,
        },
        'vendor.js': {
          type: 'chunk',
          code: 'export const vendor = true;',
          fileName: 'vendor.js',
          name: 'vendor',
          moduleIds: ['node_modules/vendor/index.js'],
          isEntry: false,
          exports: ['vendor'],
          imports: [],
        },
      };

      expect(Object.keys(bundle)).toHaveLength(3);
      expect(bundle['main.js'].type).toBe('chunk');
      expect(bundle['style.css'].type).toBe('asset');
      expect(bundle['vendor.js'].type).toBe('chunk');
    });

    it('should handle empty bundle', () => {
      const emptyBundle: XOutputBundle = {};
      expect(Object.keys(emptyBundle)).toHaveLength(0);
    });

    it('should handle bundle with only assets', () => {
      const assetBundle: XOutputBundle<XOutputAsset> = {
        'style.css': {
          type: 'asset',
          source: '.app { margin: 0; }',
          fileName: 'style.css',
          names: ['style.css'],
          originalFileNames: ['src/style.css'],
          needsCodeReference: false,
        },
        'logo.svg': {
          type: 'asset',
          source: '<svg>...</svg>',
          fileName: 'logo.svg',
          names: ['logo.svg'],
          originalFileNames: ['src/assets/logo.svg'],
          needsCodeReference: false,
        },
      };

      Object.values(assetBundle).forEach((asset) => {
        expect(asset.type).toBe('asset');
      });
    });

    it('should handle bundle with only chunks', () => {
      const chunkBundle: XOutputBundle<XOutputChunk> = {
        'app.js': {
          type: 'chunk',
          code: 'import "./style.css";',
          fileName: 'app.js',
          name: 'app',
          moduleIds: ['src/app.js'],
          isEntry: true,
          exports: [],
          imports: ['./style.css'],
        },
        'utils.js': {
          type: 'chunk',
          code: 'export const utils = {};',
          fileName: 'utils.js',
          name: 'utils',
          moduleIds: ['src/utils.js'],
          isEntry: false,
          exports: ['utils'],
          imports: [],
        },
      };

      Object.values(chunkBundle).forEach((chunk) => {
        expect(chunk.type).toBe('chunk');
      });
    });
  });

  describe('Type compatibility and interfaces', () => {
    it('should allow XPreRenderdAsset to be used as base for XOutputAsset', () => {
      const preRendered: XPreRenderdAsset = {
        names: ['test.css'],
        originalFileNames: ['src/test.css'],
        source: '.test { color: green; }',
        type: 'asset',
      };

      const output: XOutputAsset = {
        ...preRendered,
        fileName: 'test.css',
        needsCodeReference: false,
      };

      expect(output.names).toEqual(preRendered.names);
      expect(output.originalFileNames).toEqual(preRendered.originalFileNames);
      expect(output.source).toBe(preRendered.source);
      expect(output.type).toBe(preRendered.type);
    });

    it('should allow XPreRenderedChunk to be used as base for XOutputChunk', () => {
      const preRendered: XPreRenderedChunk = {
        name: 'component',
        moduleIds: ['src/Component.js'],
      };

      const output: XOutputChunk = {
        ...preRendered,
        type: 'chunk',
        code: 'export default Component;',
        fileName: 'component.js',
        isEntry: false,
        exports: ['default'],
        imports: ['react'],
      };

      expect(output.name).toBe(preRendered.name);
      expect(output.moduleIds).toEqual(preRendered.moduleIds);
    });
  });
});
