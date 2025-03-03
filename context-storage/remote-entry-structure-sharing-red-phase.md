# Remote Entry Structure Sharing - Red Phase Tests

This document outlines the initial test cases for the Remote Entry Structure Sharing implementation, following our TDD approach. These tests are designed to fail initially (Red phase) and will guide our implementation.

## Test Cases

### 1. Metadata Schema Definition

```typescript
describe('MetadataSchema', () => {
  describe('validateMetadata', () => {
    it('should validate compliant metadata', () => {
      const metadata = {
        schemaVersion: '1.0.0',
        moduleFederationVersion: '2.0.0',
        renderType: 'ssr',
        framework: 'nextjs',
        frameworkVersion: '^13.0.0',
        dependencies: {
          'react': '^18.0.0',
          'react-dom': '^18.0.0'
        },
        exports: {
          './Button': {
            import: './Button',
            types: './Button.d.ts'
          }
        }
      };
      
      expect(MetadataSchema.validateMetadata(metadata)).toBe(true);
    });
    
    it('should reject metadata missing required fields', () => {
      const metadata = {
        renderType: 'ssr',
        framework: 'nextjs'
        // Missing schemaVersion and moduleFederationVersion
      };
      
      expect(() => MetadataSchema.validateMetadata(metadata)).toThrow();
    });
    
    it('should reject metadata with invalid values', () => {
      const metadata = {
        schemaVersion: '1.0.0',
        moduleFederationVersion: '2.0.0',
        renderType: 'invalid-render-type', // Invalid renderType
        framework: 'nextjs',
        frameworkVersion: '^13.0.0'
      };
      
      expect(() => MetadataSchema.validateMetadata(metadata)).toThrow();
    });
    
    it('should handle metadata with optional fields', () => {
      const metadata = {
        schemaVersion: '1.0.0',
        moduleFederationVersion: '2.0.0',
        renderType: 'csr',
        framework: 'unknown'
        // Optional fields omitted
      };
      
      expect(MetadataSchema.validateMetadata(metadata)).toBe(true);
    });
  });
  
  describe('createDefaultMetadata', () => {
    it('should create metadata with defaults', () => {
      const defaults = MetadataSchema.createDefaultMetadata();
      
      expect(defaults.schemaVersion).toBe('1.0.0');
      expect(defaults.moduleFederationVersion).toBeDefined();
      expect(defaults.renderType).toBe('csr');
      expect(defaults.framework).toBe('unknown');
    });
    
    it('should allow overriding defaults', () => {
      const defaults = MetadataSchema.createDefaultMetadata({
        renderType: 'ssr',
        framework: 'nextjs'
      });
      
      expect(defaults.schemaVersion).toBe('1.0.0');
      expect(defaults.renderType).toBe('ssr');
      expect(defaults.framework).toBe('nextjs');
    });
  });
});
```

### 2. Metadata Extraction

```typescript
describe('MetadataExtractor', () => {
  describe('extractFromPackage', () => {
    it('should extract metadata from package.json', () => {
      const packageJson = {
        name: 'test-remote',
        version: '1.0.0',
        dependencies: {
          'next': '^13.0.0',
          'react': '^18.0.0',
          'react-dom': '^18.0.0'
        }
      };
      
      const metadata = MetadataExtractor.extractFromPackage(packageJson);
      
      expect(metadata.framework).toBe('nextjs');
      expect(metadata.frameworkVersion).toBe('^13.0.0');
      expect(metadata.renderType).toBe('ssr');
      expect(metadata.dependencies).toEqual({
        'next': '^13.0.0',
        'react': '^18.0.0',
        'react-dom': '^18.0.0'
      });
    });
    
    it('should detect Module Federation version', () => {
      const packageJson = {
        dependencies: {
          '@module-federation/enhanced': '^1.5.0'
        }
      };
      
      const metadata = MetadataExtractor.extractFromPackage(packageJson);
      
      expect(metadata.moduleFederationVersion).toBe('2.0.0');
    });
    
    it('should detect Module Federation version from webpack plugin', () => {
      const packageJson = {
        dependencies: {
          'webpack': '^5.0.0'
        }
      };
      
      const webpackConfig = {
        plugins: [
          { constructor: { name: 'ModuleFederationPlugin' } }
        ]
      };
      
      const metadata = MetadataExtractor.extractFromPackage(packageJson, webpackConfig);
      
      expect(metadata.moduleFederationVersion).toBe('1.0.0');
    });
    
    it('should extract export information if available', () => {
      const packageJson = {
        name: 'remote-components',
        exports: {
          './Button': './lib/Button.js',
          './Input': './lib/Input.js'
        }
      };
      
      const metadata = MetadataExtractor.extractFromPackage(packageJson);
      
      expect(metadata.exports).toBeDefined();
      expect(metadata.exports['./Button']).toBeDefined();
      expect(metadata.exports['./Input']).toBeDefined();
    });
  });
  
  describe('extractFromBundlerConfig', () => {
    it('should extract metadata from webpack ModuleFederation plugin', () => {
      const webpackConfig = {
        plugins: [
          {
            constructor: { name: 'ModuleFederationPlugin' },
            _options: {
              name: 'remote',
              filename: 'remoteEntry.js',
              exposes: {
                './Button': './src/components/Button',
                './Header': './src/components/Header'
              }
            }
          }
        ]
      };
      
      const metadata = MetadataExtractor.extractFromBundlerConfig(webpackConfig);
      
      expect(metadata.moduleFederationVersion).toBe('1.0.0');
      expect(metadata.exports).toEqual({
        './Button': { import: './src/components/Button' },
        './Header': { import: './src/components/Header' }
      });
    });
    
    it('should extract metadata from MF 2.0 enhanced plugin', () => {
      const webpackConfig = {
        plugins: [
          {
            constructor: { name: 'EasyFederationPlugin' },
            _options: {
              name: 'remote',
              exposes: [
                { remote: './Button', entry: './src/components/Button' },
                { remote: './Header', entry: './src/components/Header', types: './src/components/Header.d.ts' }
              ]
            }
          }
        ]
      };
      
      const metadata = MetadataExtractor.extractFromBundlerConfig(webpackConfig);
      
      expect(metadata.moduleFederationVersion).toBe('2.0.0');
      expect(metadata.exports).toEqual({
        './Button': { import: './src/components/Button' },
        './Header': { 
          import: './src/components/Header',
          types: './src/components/Header.d.ts'
        }
      });
    });
    
    it('should detect renderType from webpack target', () => {
      const webpackConfig = {
        target: 'node',
        plugins: [
          { constructor: { name: 'ModuleFederationPlugin' } }
        ]
      };
      
      const metadata = MetadataExtractor.extractFromBundlerConfig(webpackConfig);
      
      expect(metadata.renderType).toBe('ssr');
    });
  });
});
```

### 3. Metadata Publishing

```typescript
describe('MetadataPublisher', () => {
  describe('publishMetadata', () => {
    it('should publish metadata file alongside remoteEntry', () => {
      const metadata = {
        schemaVersion: '1.0.0',
        moduleFederationVersion: '2.0.0',
        renderType: 'ssr',
        framework: 'nextjs',
        frameworkVersion: '^13.0.0'
      };
      
      const outputPath = '/dist';
      const remoteEntryFilename = 'remoteEntry.js';
      
      const filePath = MetadataPublisher.publishMetadata(metadata, outputPath, remoteEntryFilename);
      
      expect(filePath).toBe('/dist/remoteEntry.metadata.json');
      // Check file was written with correct content
      expect(fs.existsSync(filePath)).toBe(true);
      expect(JSON.parse(fs.readFileSync(filePath, 'utf8'))).toEqual(metadata);
    });
    
    it('should create a valid manifest URL pattern', () => {
      const remoteUrl = 'https://example.com/remote/remoteEntry.js';
      
      const metadataUrl = MetadataPublisher.getMetadataUrl(remoteUrl);
      
      expect(metadataUrl).toBe('https://example.com/remote/remoteEntry.metadata.json');
    });
    
    it('should handle remote URLs with query parameters', () => {
      const remoteUrl = 'https://example.com/remote/remoteEntry.js?v=123';
      
      const metadataUrl = MetadataPublisher.getMetadataUrl(remoteUrl);
      
      expect(metadataUrl).toBe('https://example.com/remote/remoteEntry.metadata.json?v=123');
    });
  });
});
```

### 4. Metadata Consumption

```typescript
describe('MetadataConsumer', () => {
  describe('fetchMetadata', () => {
    it('should fetch metadata from a remote URL', async () => {
      // Mock fetch
      global.fetch = jest.fn().mockImplementation(() => 
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            schemaVersion: '1.0.0',
            moduleFederationVersion: '2.0.0',
            renderType: 'ssr',
            framework: 'nextjs'
          })
        })
      );
      
      const remoteUrl = 'https://example.com/remote/remoteEntry.js';
      
      const metadata = await MetadataConsumer.fetchMetadata(remoteUrl);
      
      expect(metadata.schemaVersion).toBe('1.0.0');
      expect(metadata.renderType).toBe('ssr');
      expect(metadata.framework).toBe('nextjs');
    });
    
    it('should handle missing metadata gracefully', async () => {
      // Mock fetch with 404
      global.fetch = jest.fn().mockImplementation(() => 
        Promise.resolve({
          ok: false,
          status: 404
        })
      );
      
      const remoteUrl = 'https://example.com/remote/remoteEntry.js';
      
      const metadata = await MetadataConsumer.fetchMetadata(remoteUrl);
      
      // Should return default metadata
      expect(metadata.schemaVersion).toBe('1.0.0');
      expect(metadata.renderType).toBe('csr');
      expect(metadata.framework).toBe('unknown');
    });
    
    it('should cache metadata', async () => {
      // Mock fetch
      global.fetch = jest.fn().mockImplementation(() => 
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            schemaVersion: '1.0.0',
            moduleFederationVersion: '2.0.0',
            renderType: 'ssr',
            framework: 'nextjs'
          })
        })
      );
      
      const remoteUrl = 'https://example.com/remote/remoteEntry.js';
      
      // First fetch
      await MetadataConsumer.fetchMetadata(remoteUrl);
      
      // Second fetch - should use cache
      await MetadataConsumer.fetchMetadata(remoteUrl);
      
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });
  
  describe('validateCompatibility', () => {
    it('should validate compatible remotes', () => {
      const hostMetadata = {
        schemaVersion: '1.0.0',
        moduleFederationVersion: '2.0.0',
        renderType: 'ssr',
        framework: 'nextjs',
        frameworkVersion: '^13.0.0'
      };
      
      const remoteMetadata = {
        schemaVersion: '1.0.0',
        moduleFederationVersion: '2.0.0',
        renderType: 'ssr',
        framework: 'nextjs',
        frameworkVersion: '^13.0.0'
      };
      
      const result = MetadataConsumer.validateCompatibility(hostMetadata, remoteMetadata);
      
      expect(result.compatible).toBe(true);
      expect(result.issues).toHaveLength(0);
    });
    
    it('should report incompatible renderTypes', () => {
      const hostMetadata = {
        schemaVersion: '1.0.0',
        moduleFederationVersion: '2.0.0',
        renderType: 'csr',
        framework: 'vite-react'
      };
      
      const remoteMetadata = {
        schemaVersion: '1.0.0',
        moduleFederationVersion: '2.0.0',
        renderType: 'ssr',
        framework: 'nextjs'
      };
      
      const result = MetadataConsumer.validateCompatibility(hostMetadata, remoteMetadata);
      
      expect(result.compatible).toBe(false);
      expect(result.issues).toContain('renderType mismatch: host is csr, remote is ssr');
    });
    
    it('should warn about different frameworks', () => {
      const hostMetadata = {
        schemaVersion: '1.0.0',
        moduleFederationVersion: '2.0.0',
        renderType: 'csr',
        framework: 'vite-react'
      };
      
      const remoteMetadata = {
        schemaVersion: '1.0.0',
        moduleFederationVersion: '2.0.0',
        renderType: 'csr',
        framework: 'cra'
      };
      
      const result = MetadataConsumer.validateCompatibility(hostMetadata, remoteMetadata);
      
      expect(result.compatible).toBe(true);
      expect(result.warnings).toContain('framework mismatch: host is vite-react, remote is cra');
    });
    
    it('should warn about version conflicts', () => {
      const hostMetadata = {
        schemaVersion: '1.0.0',
        moduleFederationVersion: '2.0.0',
        renderType: 'csr',
        framework: 'vite-react',
        dependencies: {
          'react': '^18.0.0'
        }
      };
      
      const remoteMetadata = {
        schemaVersion: '1.0.0',
        moduleFederationVersion: '2.0.0',
        renderType: 'csr',
        framework: 'vite-react',
        dependencies: {
          'react': '^17.0.0'
        }
      };
      
      const result = MetadataConsumer.validateCompatibility(hostMetadata, remoteMetadata);
      
      expect(result.compatible).toBe(true);
      expect(result.warnings).toContain('react version mismatch: host ^18.0.0, remote ^17.0.0');
    });
  });
});
```

### 5. Integration Tests

```typescript
describe('RemoteStructureSharingIntegration', () => {
  describe('setupBundlerPlugin', () => {
    it('should add metadata plugin to webpack configuration', () => {
      const webpackConfig = {
        plugins: [
          {
            constructor: { name: 'ModuleFederationPlugin' },
            _options: {
              name: 'remote',
              filename: 'remoteEntry.js',
              exposes: {
                './Button': './src/components/Button'
              }
            }
          }
        ]
      };
      
      const packageJson = {
        dependencies: {
          'react': '^18.0.0',
          'webpack': '^5.0.0'
        }
      };
      
      const updatedConfig = RemoteStructureSharingIntegration.setupBundlerPlugin(webpackConfig, packageJson);
      
      // Should add a new plugin
      expect(updatedConfig.plugins.length).toBe(2);
      expect(updatedConfig.plugins[1].name).toBe('MetadataPublisherPlugin');
    });
    
    it('should add metadata plugin to Vite configuration', () => {
      const viteConfig = {
        plugins: [
          { name: 'vite:react-babel' }
        ],
        build: {
          outDir: 'dist'
        }
      };
      
      const packageJson = {
        dependencies: {
          'react': '^18.0.0',
          'vite': '^4.0.0'
        }
      };
      
      const updatedConfig = RemoteStructureSharingIntegration.setupBundlerPlugin(viteConfig, packageJson);
      
      // Should add a new plugin
      expect(updatedConfig.plugins.length).toBe(2);
      expect(updatedConfig.plugins[1].name).toBe('metadata-publisher');
    });
  });
  
  describe('setupConsumerPlugin', () => {
    it('should add metadata consumer plugin to webpack configuration', () => {
      const webpackConfig = {
        plugins: [
          {
            constructor: { name: 'ModuleFederationPlugin' },
            _options: {
              name: 'host',
              remotes: {
                remote1: 'remote1@https://example.com/remote1/remoteEntry.js',
                remote2: 'remote2@https://example.com/remote2/remoteEntry.js'
              }
            }
          }
        ]
      };
      
      const updatedConfig = RemoteStructureSharingIntegration.setupConsumerPlugin(webpackConfig);
      
      // Should add a new plugin
      expect(updatedConfig.plugins.length).toBe(2);
      expect(updatedConfig.plugins[1].name).toBe('MetadataConsumerPlugin');
    });
    
    it('should process MF 2.0 remotes format', () => {
      const webpackConfig = {
        plugins: [
          {
            constructor: { name: 'EasyFederationPlugin' },
            _options: {
              name: 'host',
              remotes: [
                { name: 'remote1', entry: 'https://example.com/remote1/remoteEntry.js' },
                { name: 'remote2', entry: 'https://example.com/remote2/remoteEntry.js' }
              ]
            }
          }
        ]
      };
      
      const updatedConfig = RemoteStructureSharingIntegration.setupConsumerPlugin(webpackConfig);
      
      // Should add a new plugin
      expect(updatedConfig.plugins.length).toBe(2);
      expect(updatedConfig.plugins[1].name).toBe('MetadataConsumerPlugin');
      
      // Plugin should have the correct remote URLs
      expect(updatedConfig.plugins[1].remotes).toContain('https://example.com/remote1/remoteEntry.js');
      expect(updatedConfig.plugins[1].remotes).toContain('https://example.com/remote2/remoteEntry.js');
    });
  });
  
  describe('validateRemoteCompatibility', () => {
    it('should validate remote compatibility and report issues', async () => {
      // Mock fetch for remote1 metadata
      global.fetch = jest.fn()
        .mockImplementationOnce(() => 
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              schemaVersion: '1.0.0',
              moduleFederationVersion: '2.0.0',
              renderType: 'ssr',
              framework: 'nextjs'
            })
          })
        )
        .mockImplementationOnce(() => 
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              schemaVersion: '1.0.0',
              moduleFederationVersion: '2.0.0',
              renderType: 'csr',
              framework: 'vite-react'
            })
          })
        );
      
      const hostMetadata = {
        schemaVersion: '1.0.0',
        moduleFederationVersion: '2.0.0',
        renderType: 'ssr',
        framework: 'nextjs'
      };
      
      const remotes = {
        remote1: 'remote1@https://example.com/remote1/remoteEntry.js',
        remote2: 'remote2@https://example.com/remote2/remoteEntry.js'
      };
      
      const results = await RemoteStructureSharingIntegration.validateRemoteCompatibility(hostMetadata, remotes);
      
      expect(results.remote1.compatible).toBe(true);
      expect(results.remote2.compatible).toBe(false);
      expect(results.remote2.issues).toContain('renderType mismatch: host is ssr, remote is csr');
    });
  });
});
```

## Next Steps

1. Create the necessary module structure and empty classes/functions to match these tests
2. Run the tests to verify they fail (Red phase)
3. Implement the functionality to make the tests pass (Green phase)
4. Refactor the code while keeping the tests passing

## Implementation Approach

Based on these tests, we'll need to create:

1. `MetadataSchema` - Schema definition and validation for structure metadata
2. `MetadataExtractor` - Extraction of metadata from packages and bundler configs
3. `MetadataPublisher` - Publishing of metadata alongside remoteEntry files
4. `MetadataConsumer` - Consumption and compatibility validation of remote metadata
5. `RemoteStructureSharingIntegration` - High-level integration with bundlers

The implementation will follow our TDD approach, starting with making these tests pass one by one.