/**
 * Integration tests for Remote Entry Structure Sharing
 * 
 * These tests validate the integration of the Remote Entry Structure Sharing component
 * with actual bundler configurations, ensuring proper metadata extraction, publication,
 * and consumption across different bundler types.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  MetadataSchema,
  MetadataExtractor,
  MetadataPublisher,
  MetadataConsumer,
  RemoteStructureSharingIntegration,
  RemoteMetadata
} from '../remote-entry-structure-sharing-skeleton';

// Mock for webpack compiler hooks
const createMockCompiler = () => {
  return {
    hooks: {
      afterEmit: {
        tap: jest.fn((name, callback) => {
          callback({ outputOptions: { path: path.join(os.tmpdir(), 'webpack-output') } });
        })
      },
      beforeCompile: {
        tapAsync: jest.fn((name, callback) => {
          callback({}, () => {});
        })
      }
    }
  };
};

// Mock for fetch API
global.fetch = jest.fn().mockImplementation((url) => {
  if (url.includes('metadata.json')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        schemaVersion: '1.0.0',
        moduleFederationVersion: '2.0.0',
        renderType: 'ssr',
        framework: 'nextjs',
        frameworkVersion: '^13.0.0'
      })
    });
  }
  return Promise.resolve({
    ok: false,
    status: 404
  });
});

describe('Remote Entry Structure Sharing - Integration Tests', () => {
  
  // Create temp directory for testing
  const testOutputDir = path.join(os.tmpdir(), 'zephyr-test-output');
  
  beforeAll(() => {
    // Ensure test directory exists
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true });
    }
    
    // Create webpack output directory
    const webpackOutput = path.join(os.tmpdir(), 'webpack-output');
    if (!fs.existsSync(webpackOutput)) {
      fs.mkdirSync(webpackOutput, { recursive: true });
    }
  });
  
  afterAll(() => {
    // Cleanup test files
    if (fs.existsSync(path.join(testOutputDir, 'remoteEntry.metadata.json'))) {
      fs.unlinkSync(path.join(testOutputDir, 'remoteEntry.metadata.json'));
    }
    if (fs.existsSync(path.join(os.tmpdir(), 'webpack-output', 'remoteEntry.metadata.json'))) {
      fs.unlinkSync(path.join(os.tmpdir(), 'webpack-output', 'remoteEntry.metadata.json'));
    }
  });
  
  describe('Webpack Integration', () => {
    it('should extract metadata from webpack configuration', () => {
      const webpackConfig = {
        plugins: [
          {
            constructor: { name: 'ModuleFederationPlugin' },
            _options: {
              name: 'remote',
              filename: 'remoteEntry.js',
              exposes: {
                './Button': './src/components/Button',
                './Card': './src/components/Card'
              }
            }
          }
        ]
      };
      
      const metadata = MetadataExtractor.extractFromBundlerConfig(webpackConfig);
      
      expect(metadata.moduleFederationVersion).toBe('1.0.0');
      expect(metadata.exports).toBeDefined();
      expect(metadata.exports!['./Button']).toBeDefined();
      expect(metadata.exports!['./Card']).toBeDefined();
    });
    
    it('should add metadata publisher plugin to webpack config', () => {
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
          'react': '18.2.0',
          'next': '13.4.19'
        }
      };
      
      const updatedConfig = RemoteStructureSharingIntegration.setupBundlerPlugin(
        webpackConfig,
        packageJson
      );
      
      // Should add the publisher plugin
      expect(updatedConfig.plugins.length).toBe(2);
      expect(updatedConfig.plugins[1].name).toBe('MetadataPublisherPlugin');
      
      // Test plugin functionality
      const mockCompiler = createMockCompiler();
      updatedConfig.plugins[1].apply(mockCompiler);
      
      expect(mockCompiler.hooks.afterEmit.tap).toHaveBeenCalledWith(
        'MetadataPublisherPlugin',
        expect.any(Function)
      );
    });
    
    it('should add metadata consumer plugin to webpack config', () => {
      const webpackConfig = {
        plugins: [
          {
            constructor: { name: 'ModuleFederationPlugin' },
            _options: {
              name: 'host',
              remotes: {
                remote1: 'remote1@https://example.com/remote1/remoteEntry.js'
              }
            }
          }
        ]
      };
      
      const updatedConfig = RemoteStructureSharingIntegration.setupConsumerPlugin(webpackConfig);
      
      // Should add the consumer plugin
      expect(updatedConfig.plugins.length).toBe(2);
      expect(updatedConfig.plugins[1].name).toBe('MetadataConsumerPlugin');
      expect(updatedConfig.plugins[1].remotes).toContain('https://example.com/remote1/remoteEntry.js');
      
      // Test plugin functionality
      const mockCompiler = createMockCompiler();
      updatedConfig.plugins[1].apply(mockCompiler);
      
      expect(mockCompiler.hooks.beforeCompile.tapAsync).toHaveBeenCalledWith(
        'MetadataConsumerPlugin',
        expect.any(Function)
      );
    });
  });
  
  describe('Vite Integration', () => {
    it('should extract metadata from package.json with Vite dependencies', () => {
      const packageJson = {
        dependencies: {
          'vite': '^4.4.9',
          'react': '^18.2.0',
          '@module-federation/vite': '^0.5.0'
        }
      };
      
      const metadata = MetadataExtractor.extractFromPackage(packageJson);
      
      expect(metadata.framework).toBe('react');
      expect(metadata.renderType).toBe('csr'); // Vite is typically CSR by default
      expect(metadata.moduleFederationVersion).toBe('2.0.0'); // MF 2.0 from @module-federation/vite
    });
    
    it('should add metadata publisher plugin to Vite config', () => {
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
          'vite': '^4.4.9',
          'react': '^18.2.0'
        }
      };
      
      const updatedConfig = RemoteStructureSharingIntegration.setupBundlerPlugin(
        viteConfig,
        packageJson
      );
      
      // Should add the publisher plugin
      expect(updatedConfig.plugins.length).toBe(2);
      expect(updatedConfig.plugins[1].name).toBe('metadata-publisher');
      expect(updatedConfig.plugins[1].closeBundle).toBeDefined();
    });
  });
  
  describe('Next.js Integration', () => {
    it('should detect Next.js SSR from package.json', () => {
      const packageJson = {
        dependencies: {
          'next': '^13.4.19',
          'react': '^18.2.0',
          'react-dom': '^18.2.0'
        }
      };
      
      const metadata = MetadataExtractor.extractFromPackage(packageJson);
      
      expect(metadata.framework).toBe('nextjs');
      expect(metadata.renderType).toBe('ssr');
      expect(metadata.frameworkVersion).toBe('^13.4.19');
    });
  });
  
  describe('Metadata Publishing and Consumption', () => {
    it('should publish and read metadata files', () => {
      const testMetadata: RemoteMetadata = {
        schemaVersion: '1.0.0',
        moduleFederationVersion: '2.0.0',
        renderType: 'ssr',
        framework: 'nextjs',
        frameworkVersion: '^13.4.19',
        dependencies: {
          'react': '^18.2.0',
          'react-dom': '^18.2.0'
        },
        exports: {
          './Button': { import: './src/components/Button' }
        }
      };
      
      // Publish metadata
      const metadataFilePath = MetadataPublisher.publishMetadata(
        testMetadata,
        testOutputDir,
        'remoteEntry.js'
      );
      
      // Verify file was created with correct content
      expect(fs.existsSync(metadataFilePath)).toBe(true);
      
      const fileContent = JSON.parse(fs.readFileSync(metadataFilePath, 'utf8'));
      
      expect(fileContent.schemaVersion).toBe('1.0.0');
      expect(fileContent.moduleFederationVersion).toBe('2.0.0');
      expect(fileContent.renderType).toBe('ssr');
      expect(fileContent.framework).toBe('nextjs');
      expect(fileContent.exports['./Button']).toBeDefined();
    });
    
    it('should generate correct metadata URL from remoteEntry URL', () => {
      const remoteUrl = 'https://example.com/remote/remoteEntry.js';
      const metadataUrl = MetadataPublisher.getMetadataUrl(remoteUrl);
      
      expect(metadataUrl).toBe('https://example.com/remote/remoteEntry.metadata.json');
      
      // Test with query parameters
      const remoteUrlWithQuery = 'https://example.com/remote/remoteEntry.js?v=123';
      const metadataUrlWithQuery = MetadataPublisher.getMetadataUrl(remoteUrlWithQuery);
      
      expect(metadataUrlWithQuery).toBe('https://example.com/remote/remoteEntry.metadata.json?v=123');
    });
  });
  
  describe('Compatibility Validation', () => {
    it('should validate compatibility between host and compatible remote', () => {
      const hostMetadata: RemoteMetadata = {
        schemaVersion: '1.0.0',
        moduleFederationVersion: '2.0.0',
        renderType: 'ssr',
        framework: 'nextjs',
        dependencies: {
          'react': '^18.2.0'
        }
      };
      
      const remoteMetadata: RemoteMetadata = {
        schemaVersion: '1.0.0',
        moduleFederationVersion: '2.0.0',
        renderType: 'ssr',
        framework: 'nextjs',
        dependencies: {
          'react': '^18.2.0'
        }
      };
      
      const result = MetadataConsumer.validateCompatibility(hostMetadata, remoteMetadata);
      
      expect(result.compatible).toBe(true);
      expect(result.issues.length).toBe(0);
      expect(result.warnings.length).toBe(0);
    });
    
    it('should detect incompatibility between CSR host and SSR remote', () => {
      const hostMetadata: RemoteMetadata = {
        schemaVersion: '1.0.0',
        moduleFederationVersion: '2.0.0',
        renderType: 'csr',
        framework: 'react',
        dependencies: {
          'react': '^18.2.0'
        }
      };
      
      const remoteMetadata: RemoteMetadata = {
        schemaVersion: '1.0.0',
        moduleFederationVersion: '2.0.0',
        renderType: 'ssr',
        framework: 'nextjs',
        dependencies: {
          'react': '^18.2.0'
        }
      };
      
      const result = MetadataConsumer.validateCompatibility(hostMetadata, remoteMetadata);
      
      expect(result.compatible).toBe(false);
      expect(result.issues).toContain('renderType mismatch: host is csr, remote is ssr');
    });
    
    it('should warn about different frameworks but remain compatible', () => {
      const hostMetadata: RemoteMetadata = {
        schemaVersion: '1.0.0',
        moduleFederationVersion: '2.0.0',
        renderType: 'csr',
        framework: 'react',
        dependencies: {
          'react': '^18.2.0'
        }
      };
      
      const remoteMetadata: RemoteMetadata = {
        schemaVersion: '1.0.0',
        moduleFederationVersion: '2.0.0',
        renderType: 'csr',
        framework: 'vue',
        dependencies: {
          'vue': '^3.2.0'
        }
      };
      
      const result = MetadataConsumer.validateCompatibility(hostMetadata, remoteMetadata);
      
      expect(result.compatible).toBe(true);
      expect(result.warnings).toContain('framework mismatch: host is react, remote is vue');
    });
  });
  
  describe('End-to-End Integration', () => {
    it('should validate remote compatibility across multiple remotes', async () => {
      // Mock remote URLs and metadata
      global.fetch = jest.fn()
        .mockImplementationOnce(() => Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            schemaVersion: '1.0.0',
            moduleFederationVersion: '2.0.0',
            renderType: 'ssr',
            framework: 'nextjs'
          })
        }))
        .mockImplementationOnce(() => Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            schemaVersion: '1.0.0',
            moduleFederationVersion: '2.0.0',
            renderType: 'csr',
            framework: 'react'
          })
        }));
      
      const hostMetadata: RemoteMetadata = {
        schemaVersion: '1.0.0',
        moduleFederationVersion: '2.0.0',
        renderType: 'ssr',
        framework: 'nextjs'
      };
      
      const remotes = {
        remoteA: 'remoteA@https://example.com/remoteA/remoteEntry.js',
        remoteB: 'remoteB@https://example.com/remoteB/remoteEntry.js'
      };
      
      const results = await RemoteStructureSharingIntegration.validateRemoteCompatibility(
        hostMetadata,
        remotes
      );
      
      expect(results.remoteA).toBeDefined();
      expect(results.remoteB).toBeDefined();
      expect(results.remoteA.compatible).toBe(true);
      expect(results.remoteB.compatible).toBe(true);
      expect(results.remoteB.warnings).toContain('renderType mismatch: host is ssr, remote is csr');
    });
  });
});