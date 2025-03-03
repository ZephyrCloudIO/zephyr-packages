/**
 * Remote Types Detection - Tests
 * 
 * This file contains tests for the Remote Types Detection functionality.
 */

import {
  RemoteTypeDetector,
  RemoteTypeConfig,
  RemoteTypeManifest,
  FrameworkDetector,
  RemoteTypeIntegration
} from './remote-types-detection-skeleton';

/**
 * Test suite for RemoteTypeDetector
 */
describe('RemoteTypeDetector', () => {
  describe('detectFromDependencies', () => {
    it('should detect SSR from Next.js dependencies', () => {
      const dependencies = {
        'next': '^13.0.0',
        'react': '^18.0.0',
        'react-dom': '^18.0.0'
      };
      
      expect(RemoteTypeDetector.detectFromDependencies(dependencies)).toBe('ssr');
    });
    
    it('should detect SSR from Remix dependencies', () => {
      const dependencies = {
        '@remix-run/react': '^1.0.0',
        'react': '^18.0.0',
        'react-dom': '^18.0.0'
      };
      
      expect(RemoteTypeDetector.detectFromDependencies(dependencies)).toBe('ssr');
    });
    
    it('should detect SSR from Gatsby dependencies', () => {
      const dependencies = {
        'gatsby': '^4.0.0',
        'react': '^17.0.0',
        'react-dom': '^17.0.0'
      };
      
      expect(RemoteTypeDetector.detectFromDependencies(dependencies)).toBe('ssr');
    });
    
    it('should detect CSR from Create React App dependencies', () => {
      const dependencies = {
        'react-scripts': '^5.0.0',
        'react': '^18.0.0',
        'react-dom': '^18.0.0'
      };
      
      expect(RemoteTypeDetector.detectFromDependencies(dependencies)).toBe('csr');
    });
    
    it('should detect CSR from Vite React dependencies without SSR packages', () => {
      const dependencies = {
        'vite': '^4.0.0',
        '@vitejs/plugin-react': '^3.0.0',
        'react': '^18.0.0',
        'react-dom': '^18.0.0'
      };
      
      expect(RemoteTypeDetector.detectFromDependencies(dependencies)).toBe('csr');
    });
    
    it('should detect SSR from Vite with SSR-specific packages', () => {
      const dependencies = {
        'vite': '^4.0.0',
        '@vitejs/plugin-react': '^3.0.0',
        'react': '^18.0.0',
        'react-dom': '^18.0.0',
        'vite-plugin-ssr': '^1.0.0'
      };
      
      expect(RemoteTypeDetector.detectFromDependencies(dependencies)).toBe('ssr');
    });
    
    it('should default to CSR when no specific indicators are found', () => {
      const dependencies = {
        'lodash': '^4.0.0',
        'axios': '^1.0.0'
      };
      
      expect(RemoteTypeDetector.detectFromDependencies(dependencies)).toBe('csr');
    });
  });

  describe('detectFromConfiguration', () => {
    it('should detect SSR from Next.js configuration', () => {
      const config = {
        name: 'next-app',
        output: {
          serverComponents: true,
          path: '.next/server'
        }
      };
      
      expect(RemoteTypeDetector.detectFromConfiguration(config)).toBe('ssr');
    });
    
    it('should detect SSR from Vite SSR configuration', () => {
      const config = {
        plugins: [
          {
            name: 'vite-plugin-ssr',
            enforce: 'pre'
          }
        ],
        ssr: {
          noExternal: true
        }
      };
      
      expect(RemoteTypeDetector.detectFromConfiguration(config)).toBe('ssr');
    });
    
    it('should detect CSR from Vite CSR configuration', () => {
      const config = {
        plugins: [
          {
            name: 'vite:react-babel'
          }
        ],
        build: {
          outDir: 'dist'
        }
      };
      
      expect(RemoteTypeDetector.detectFromConfiguration(config)).toBe('csr');
    });
    
    it('should detect SSR from Webpack Node target', () => {
      const config = {
        target: 'node',
        output: {
          libraryTarget: 'commonjs2'
        }
      };
      
      expect(RemoteTypeDetector.detectFromConfiguration(config)).toBe('ssr');
    });
    
    it('should detect CSR from Webpack Web target', () => {
      const config = {
        target: 'web',
        output: {
          libraryTarget: 'umd'
        }
      };
      
      expect(RemoteTypeDetector.detectFromConfiguration(config)).toBe('csr');
    });
    
    it('should default to CSR when no specific configuration is found', () => {
      const config = {
        name: 'unknown-app'
      };
      
      expect(RemoteTypeDetector.detectFromConfiguration(config)).toBe('csr');
    });
  });

  describe('detectFromEntrypoints', () => {
    it('should detect SSR from server.js entrypoint', () => {
      const entrypoints = ['server.js', 'client.js'];
      
      expect(RemoteTypeDetector.detectFromEntrypoints(entrypoints)).toBe('ssr');
    });
    
    it('should detect SSR from ssr.js entrypoint', () => {
      const entrypoints = ['ssr.js', 'main.js'];
      
      expect(RemoteTypeDetector.detectFromEntrypoints(entrypoints)).toBe('ssr');
    });
    
    it('should detect CSR from single browser entrypoint', () => {
      const entrypoints = ['main.js'];
      
      expect(RemoteTypeDetector.detectFromEntrypoints(entrypoints)).toBe('csr');
    });
    
    it('should detect CSR from multiple browser entrypoints', () => {
      const entrypoints = ['main.js', 'vendor.js'];
      
      expect(RemoteTypeDetector.detectFromEntrypoints(entrypoints)).toBe('csr');
    });
  });
});

/**
 * Test suite for RemoteTypeConfig
 */
describe('RemoteTypeConfig', () => {
  describe('parseConfig', () => {
    it('should accept explicit render type', () => {
      const config = { renderType: 'ssr' };
      
      expect(RemoteTypeConfig.parseConfig(config)).toBe('ssr');
    });
    
    it('should validate render type values', () => {
      const invalidConfig = { renderType: 'invalid' };
      
      expect(() => RemoteTypeConfig.parseConfig(invalidConfig)).toThrow();
    });
    
    it('should accept "universal" as a valid type', () => {
      const config = { renderType: 'universal' };
      
      expect(RemoteTypeConfig.parseConfig(config)).toBe('universal');
    });
    
    it('should fall back to detection when render type is not specified', () => {
      const config = {};
      const detectedType = 'csr';
      
      expect(RemoteTypeConfig.parseConfig(config, detectedType)).toBe('csr');
    });
  });
});

/**
 * Test suite for RemoteTypeManifest
 */
describe('RemoteTypeManifest', () => {
  describe('addTypeToManifest', () => {
    it('should add the render type to manifest', () => {
      const manifest = {};
      const renderType = 'ssr';
      
      const result = RemoteTypeManifest.addTypeToManifest(manifest, renderType);
      
      expect(result.renderType).toBe('ssr');
    });
    
    it('should add detection confidence to manifest', () => {
      const manifest = {};
      const renderType = 'ssr';
      const confidence = 0.8;
      
      const result = RemoteTypeManifest.addTypeToManifest(manifest, renderType, confidence);
      
      expect(result.renderType).toBe('ssr');
      expect(result.detectionConfidence).toBe(0.8);
    });
    
    it('should not modify the original manifest', () => {
      const manifest = {};
      const renderType = 'ssr';
      
      RemoteTypeManifest.addTypeToManifest(manifest, renderType);
      
      expect(manifest.renderType).toBeUndefined();
    });
    
    it('should override existing render type', () => {
      const manifest = { renderType: 'csr' };
      const renderType = 'ssr';
      
      const result = RemoteTypeManifest.addTypeToManifest(manifest, renderType);
      
      expect(result.renderType).toBe('ssr');
    });
  });
});

/**
 * Test suite for FrameworkDetector
 */
describe('FrameworkDetector', () => {
  describe('detectFramework', () => {
    it('should detect Next.js', () => {
      const dependencies = {
        'next': '^13.0.0',
        'react': '^18.0.0'
      };
      
      expect(FrameworkDetector.detectFramework(dependencies)).toBe('nextjs');
    });
    
    it('should detect Remix', () => {
      const dependencies = {
        '@remix-run/react': '^1.0.0',
        'react': '^18.0.0'
      };
      
      expect(FrameworkDetector.detectFramework(dependencies)).toBe('remix');
    });
    
    it('should detect Gatsby', () => {
      const dependencies = {
        'gatsby': '^4.0.0',
        'react': '^17.0.0'
      };
      
      expect(FrameworkDetector.detectFramework(dependencies)).toBe('gatsby');
    });
    
    it('should detect Create React App', () => {
      const dependencies = {
        'react-scripts': '^5.0.0',
        'react': '^18.0.0'
      };
      
      expect(FrameworkDetector.detectFramework(dependencies)).toBe('cra');
    });
    
    it('should detect Vite React', () => {
      const dependencies = {
        'vite': '^4.0.0',
        '@vitejs/plugin-react': '^3.0.0'
      };
      
      expect(FrameworkDetector.detectFramework(dependencies)).toBe('vite-react');
    });
    
    it('should detect Vite Vue', () => {
      const dependencies = {
        'vite': '^4.0.0',
        '@vitejs/plugin-vue': '^3.0.0'
      };
      
      expect(FrameworkDetector.detectFramework(dependencies)).toBe('vite-vue');
    });
    
    it('should detect Angular', () => {
      const dependencies = {
        '@angular/core': '^15.0.0',
        '@angular/cli': '^15.0.0'
      };
      
      expect(FrameworkDetector.detectFramework(dependencies)).toBe('angular');
    });
    
    it('should return "unknown" for unrecognized framework', () => {
      const dependencies = {
        'lodash': '^4.0.0',
        'axios': '^1.0.0'
      };
      
      expect(FrameworkDetector.detectFramework(dependencies)).toBe('unknown');
    });
  });
  
  describe('getFrameworkDefaultRenderType', () => {
    it('should return SSR for Next.js', () => {
      expect(FrameworkDetector.getFrameworkDefaultRenderType('nextjs')).toBe('ssr');
    });
    
    it('should return SSR for Remix', () => {
      expect(FrameworkDetector.getFrameworkDefaultRenderType('remix')).toBe('ssr');
    });
    
    it('should return SSR for Gatsby', () => {
      expect(FrameworkDetector.getFrameworkDefaultRenderType('gatsby')).toBe('ssr');
    });
    
    it('should return CSR for Create React App', () => {
      expect(FrameworkDetector.getFrameworkDefaultRenderType('cra')).toBe('csr');
    });
    
    it('should return CSR for Vite React by default', () => {
      expect(FrameworkDetector.getFrameworkDefaultRenderType('vite-react')).toBe('csr');
    });
    
    it('should return CSR for unknown frameworks', () => {
      expect(FrameworkDetector.getFrameworkDefaultRenderType('unknown')).toBe('csr');
    });
  });
});

/**
 * Test suite for RemoteTypeIntegration
 */
describe('RemoteTypeIntegration', () => {
  describe('determineRemoteType', () => {
    it('should use explicit configuration over detection', () => {
      const packageJson = {
        dependencies: {
          'react-scripts': '^5.0.0', // would detect as CSR
          'react': '^18.0.0'
        }
      };
      
      const config = {
        renderType: 'ssr' // explicit override
      };
      
      expect(RemoteTypeIntegration.determineRemoteType(packageJson, config)).toBe('ssr');
    });
    
    it('should combine multiple detection strategies', () => {
      const packageJson = {
        dependencies: {
          'next': '^13.0.0',
          'react': '^18.0.0'
        }
      };
      
      const webpackConfig = {
        target: 'node'
      };
      
      const entrypoints = ['server.js', 'client.js'];
      
      expect(RemoteTypeIntegration.determineRemoteType(packageJson, {}, webpackConfig, entrypoints)).toBe('ssr');
    });
    
    it('should resolve conflicts with confidence levels', () => {
      // Mixed signals: Vite (typically CSR) but with SSR plugin
      const packageJson = {
        dependencies: {
          'vite': '^4.0.0',
          '@vitejs/plugin-react': '^3.0.0',
          'vite-plugin-ssr': '^1.0.0'
        }
      };
      
      const viteConfig = {
        plugins: [
          { name: 'vite-plugin-ssr' }
        ]
      };
      
      expect(RemoteTypeIntegration.determineRemoteType(packageJson, {}, viteConfig)).toBe('ssr');
    });
    
    it('should default to CSR when detection is ambiguous', () => {
      const packageJson = {
        dependencies: {
          'lodash': '^4.0.0',
          'axios': '^1.0.0'
        }
      };
      
      const config = {};
      
      expect(RemoteTypeIntegration.determineRemoteType(packageJson, config)).toBe('csr');
    });
  });
  
  describe('applyRemoteTypeToManifest', () => {
    it('should add both renderType and framework info to manifest', () => {
      const manifest = {};
      
      const packageJson = {
        dependencies: {
          'next': '^13.0.0',
          'react': '^18.0.0'
        }
      };
      
      const result = RemoteTypeIntegration.applyRemoteTypeToManifest(manifest, packageJson);
      
      expect(result.renderType).toBe('ssr');
      expect(result.framework).toBe('nextjs');
      expect(result.frameworkVersion).toBe('^13.0.0');
    });
  });
});