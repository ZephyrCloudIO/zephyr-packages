import type { ZephyrEngine } from 'zephyr-agent';
import { extractXViteBuildStats, type XOutputBundle } from 'zephyr-xpack-internal';

// Mock the zephyr-agent module
jest.mock('zephyr-agent', () => ({
  ze_log: jest.fn(),
  resolveCatalogDependencies: jest.fn((deps) => deps || {}),
}));

// Mock ZephyrEngine
const mockZephyrEngine = {
  applicationProperties: {
    name: 'test-app',
    version: '1.0.0',
  },
  gitProperties: {
    git: {
      branch: 'main',
      commit: 'abc123',
    },
  },
  env: {
    isCI: false,
  },
  snapshotId: Promise.resolve('snapshot-123'),
  application_uid: 'app-uid-123',
  build_id: Promise.resolve('build-123'),
  application_configuration: Promise.resolve({
    EDGE_URL: 'https://edge.example.com',
    PLATFORM: 'web',
    DELIMITER: '-',
  }),
  npmProperties: {
    dependencies: {
      react: '18.2.0',
      vite: '4.4.0',
    },
    devDependencies: {
      typescript: '5.0.0',
    },
    optionalDependencies: {},
    peerDependencies: {},
  },
} as unknown as ZephyrEngine;

// Mock bundle
const mockBundle: XOutputBundle = {
  'main.js': {
    type: 'chunk',
    fileName: 'main.js',
    name: 'main',
    facadeModuleId: 'src/main.tsx',
    code: 'console.log("test");', // Simplified code
    dynamicImports: [],
    imports: [],
    exports: [],
    modules: {},
    moduleIds: [],
    referencedFiles: [],
  },
  'style.css': {
    type: 'asset',
    fileName: 'style.css',
    name: undefined,
    source: 'body { color: red; }',
  },
};

describe('extractViteBuildStats', () => {
  it('should extract build stats from Vite build output', async () => {
    const result = await extractXViteBuildStats({
      zephyr_engine: mockZephyrEngine,
      bundle: mockBundle,
      mfConfig: {
        name: 'test-remote',
        filename: 'remoteEntry.js',
        remotes: {
          app1: 'http://localhost:3001/remoteEntry.js',
        },
        exposes: {
          './Button': './src/Button.tsx',
          './Header': './src/components/Header.tsx',
        },
        shared: {
          react: { singleton: true },
          'react-dom': { singleton: true },
        },
      },
      root: '/',
    });

    // Verify basic properties
    expect(result.id).toBe('app-uid-123');
    expect(result.name).toBe('test-remote');
    expect(result.version).toBe('snapshot-123');
    expect(result.remote).toBe('remoteEntry.js');
    expect(result.remotes).toEqual(['app1']);

    // Verify edge config
    expect(result.edge.url).toBe('https://edge.example.com');
    expect(result.edge.delimiter).toBe('-');

    // Verify dependencies
    expect(result.dependencies).toHaveLength(2);
    expect(result.dependencies.find((d) => d.name === 'react')).toBeTruthy();
    expect(result.dependencies.find((d) => d.name === 'vite')).toBeTruthy();

    // Verify modules (exposed components)
    expect(result.modules).toHaveLength(2);

    const buttonModule = result.modules.find((m) => m.name === 'Button');
    expect(buttonModule).toBeTruthy();
    expect(buttonModule?.id).toBe('Button:Button');
    expect(buttonModule?.file).toBe('./src/Button.tsx');
    expect(buttonModule?.applicationID).toBe('app-uid-123');
    expect(buttonModule?.requires).toContain('react');
    expect(buttonModule?.requires).toContain('react-dom');

    const headerModule = result.modules.find((m) => m.name === 'Header');
    expect(headerModule).toBeTruthy();
    expect(headerModule?.id).toBe('Header:Header');
    expect(headerModule?.file).toBe('./src/components/Header.tsx');
    expect(headerModule?.requires).toContain('react');

    // Verify metadata
    expect(result.metadata.bundler).toBe('vite');
    expect(result.metadata.fileCount).toBe(2);
    expect(result.metadata.chunkCount).toBe(1);
    expect(result.metadata.assetCount).toBe(1);
    expect(result.metadata.hasFederation).toBe(true);
  });

  it('should work with no module federation config', async () => {
    const result = await extractXViteBuildStats({
      zephyr_engine: mockZephyrEngine,
      bundle: mockBundle,
      root: '/',
    });

    expect(result.name).toBe('test-app'); // Should use app name when no MF config
    expect(result.remotes).toEqual([]);
    expect(result.metadata.hasFederation).toBe(false);
  });

  it('should extract shared dependencies for overrides field with object config', async () => {
    const result = await extractXViteBuildStats({
      zephyr_engine: mockZephyrEngine,
      bundle: mockBundle,
      mfConfig: {
        name: 'test-remote',
        filename: 'remoteEntry.js',
        shared: {
          react: {
            singleton: true,
          },
          'react-dom': {
            singleton: true,
            requiredVersion: '18.2.0',
          },
          'unknown-package': {
            singleton: true,
          },
        },
      },
      root: '/',
    });

    expect(result.overrides).toHaveLength(3);

    // Should use version from dependencies
    const reactOverride = result.overrides.find((o) => o.name === 'react');
    expect(reactOverride).toBeTruthy();
    expect(reactOverride?.version).toBe('18.2.0');

    // Should use requiredVersion when available
    const reactDomOverride = result.overrides.find((o) => o.name === 'react-dom');
    expect(reactDomOverride).toBeTruthy();
    expect(reactDomOverride?.version).toBe('18.2.0');

    // Should use default version for unknown packages
    const unknownOverride = result.overrides.find((o) => o.name === 'unknown-package');
    expect(unknownOverride).toBeTruthy();
    expect(unknownOverride?.version).toBe('0.0.0');

    // Verify structure of each override
    expect(reactOverride).toEqual({
      id: 'react',
      name: 'react',
      version: '18.2.0',
      location: 'react',
      applicationID: 'react',
    });
  });

  it('should handle complex exposes format in module federation', async () => {
    const result = await extractXViteBuildStats({
      zephyr_engine: mockZephyrEngine,
      bundle: mockBundle,
      mfConfig: {
        name: 'complex-remote',
        filename: 'remoteEntry.js',
        exposes: {
          './SimpleComponent': './src/components/Simple.tsx',
          // Object format that some Module Federation implementations use
          './ComplexComponent': {
            import: './src/components/Complex.tsx',
            name: 'ComplexComponent',
          },
        },
        // Array format of shared dependencies
        shared: ['react', 'react-dom'],
      },
      root: '/',
    });

    expect(result.modules).toHaveLength(2);

    // Check simple format
    const simpleModule = result.modules.find((m) => m.name === 'SimpleComponent');
    expect(simpleModule).toBeTruthy();
    expect(simpleModule?.file).toBe('./src/components/Simple.tsx');
    expect(simpleModule?.requires).toContain('react');
    expect(simpleModule?.requires).toContain('react-dom');

    // Check complex format
    const complexModule = result.modules.find((m) => m.name === 'ComplexComponent');
    expect(complexModule).toBeTruthy();
    expect(complexModule?.file).toBe('./src/components/Complex.tsx');
    expect(complexModule?.requires).toContain('react');
  });

  it('should handle additionalShared format from Nx webpack module federation', async () => {
    const result = await extractXViteBuildStats({
      zephyr_engine: mockZephyrEngine,
      bundle: mockBundle,
      mfConfig: {
        name: 'nx-remote',
        filename: 'remoteEntry.js',
        exposes: {
          './NxComponent': './src/app/nx-component.tsx',
        },
        // The Nx module federation format
        additionalShared: [
          {
            libraryName: 'react',
            sharedConfig: { singleton: true },
          },
          {
            libraryName: 'react-dom',
            sharedConfig: { singleton: true },
          },
        ],
      },
      root: '/',
    });

    expect(result.modules).toHaveLength(1);

    const nxComponent = result.modules[0];
    expect(nxComponent.name).toBe('NxComponent');
    expect(nxComponent.file).toBe('./src/app/nx-component.tsx');
    expect(nxComponent.requires).toContain('react');
    expect(nxComponent.requires).toContain('react-dom');
  });

  it('should extract shared dependencies for overrides field with string config', async () => {
    const result = await extractXViteBuildStats({
      zephyr_engine: mockZephyrEngine,
      bundle: mockBundle,
      mfConfig: {
        name: 'test-remote',
        filename: 'remoteEntry.js',
        shared: {
          react: '19.0.0', // String format
          vite: '5.0.0', // Package exists in dependencies but with different version
          'unknown-pkg': '2.0.0', // Package doesn't exist in dependencies
        },
      },
      root: '/',
    });

    expect(result.overrides).toHaveLength(3);

    // Should use dependencies version for known packages
    const reactOverride = result.overrides.find((o) => o.name === 'react');
    expect(reactOverride).toBeTruthy();
    expect(reactOverride?.version).toBe('18.2.0'); // From dependencies, not from shared config

    const viteOverride = result.overrides.find((o) => o.name === 'vite');
    expect(viteOverride).toBeTruthy();
    expect(viteOverride?.version).toBe('4.4.0'); // From dependencies, not from shared config

    // Should use string value for unknown packages
    const unknownOverride = result.overrides.find((o) => o.name === 'unknown-pkg');
    expect(unknownOverride).toBeTruthy();
    expect(unknownOverride?.version).toBe('2.0.0'); // From shared config
  });
});
