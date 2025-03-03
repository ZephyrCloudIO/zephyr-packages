/**
 * Tests for enhanced runtime code generation
 */

import {
  createMfRuntimeCode,
  ZeResolvedDependency,
  RuntimeCodeOptions,
  createRetryPlugin,
  createSemverPlugin,
  createSSRPlugin
} from '../enhanced-runtime-code-generation';

import { MFVersion } from '../enhanced-plugin-detection';

describe('Enhanced Runtime Code Generation', () => {
  const baseDependency: ZeResolvedDependency = {
    name: 'test-remote',
    application_uid: 'test-app-123',
    remote_entry_url: 'https://example.com/remoteEntry.js',
    default_url: 'https://example.com/remoteEntry.js',
    library_type: 'var'
  };
  
  describe('createMfRuntimeCode', () => {
    it('should generate basic MF 1.0 runtime code', () => {
      const code = createMfRuntimeCode(baseDependency, MFVersion.MF1);
      
      expect(code).toContain('test-remote');
      expect(code).toContain('https://example.com/remoteEntry.js');
      expect(code).not.toContain('MF 2.0');
    });
    
    it('should generate basic MF 2.0 runtime code', () => {
      const code = createMfRuntimeCode(baseDependency, MFVersion.MF2);
      
      expect(code).toContain('test-remote');
      expect(code).toContain('https://example.com/remoteEntry.js');
      expect(code).toContain('attemptLoadWithRetry');
    });
    
    it('should include semver support when specified', () => {
      const dependency = {
        ...baseDependency,
        version: '^1.0.0'
      };
      
      const options: RuntimeCodeOptions = {
        includeSemver: true
      };
      
      const code = createMfRuntimeCode(dependency, MFVersion.MF1, options);
      
      expect(code).toContain('Semver utilities');
      expect(code).toContain('^1.0.0');
      expect(code).toContain('version.match');
    });
    
    it('should include fallback support when specified', () => {
      const dependency = {
        ...baseDependency,
        fallbacks: [
          'https://fallback1.example.com/remoteEntry.js',
          'https://fallback2.example.com/remoteEntry.js'
        ]
      };
      
      const options: RuntimeCodeOptions = {
        includeFallbacks: true
      };
      
      const code = createMfRuntimeCode(dependency, MFVersion.MF2, options);
      
      expect(code).toContain('Fallback URLs in priority order');
      expect(code).toContain('fallbackUrls');
      expect(code).toContain('getNextFallbackUrl');
    });
    
    it('should include SSR support when specified', () => {
      const dependency = {
        ...baseDependency,
        ssrEnabled: true
      };
      
      const options: RuntimeCodeOptions = {
        includeSSR: true
      };
      
      const code = createMfRuntimeCode(dependency, MFVersion.MF2, options);
      
      expect(code).toContain('SSR utilities');
      expect(code).toContain('__ZEPHYR_SSR_STORE');
      expect(code).toContain('hydrateRemoteModule');
    });
    
    it('should include circuit breaker for MF 2.0 when specified', () => {
      const options: RuntimeCodeOptions = {
        circuitBreakerEnabled: true
      };
      
      const code = createMfRuntimeCode(baseDependency, MFVersion.MF2, options);
      
      expect(code).toContain('CircuitBreaker');
      expect(code).toContain('OPEN');
      expect(code).toContain('HALF-OPEN');
      expect(code).toContain('circuitBreaker.execute');
    });
    
    it('should include runtime plugins when specified', () => {
      const retryPlugin = createRetryPlugin({
        fetch: { retryTimes: 3 }
      });
      
      const options: RuntimeCodeOptions = {
        plugins: [retryPlugin]
      };
      
      const code = createMfRuntimeCode(baseDependency, MFVersion.MF2, options);
      
      expect(code).toContain('Register Zephyr runtime plugins');
      expect(code).toContain('zephyr-retry-plugin');
      expect(code).toContain('registerPlugins');
    });
    
    it('should combine multiple features when requested', () => {
      const dependency = {
        ...baseDependency,
        version: '^2.0.0',
        fallbacks: ['https://fallback.example.com/remoteEntry.js'],
        ssrEnabled: true
      };
      
      const options: RuntimeCodeOptions = {
        includeSemver: true,
        includeFallbacks: true,
        includeSSR: true,
        circuitBreakerEnabled: true,
        plugins: [
          createRetryPlugin(),
          createSemverPlugin()
        ]
      };
      
      const code = createMfRuntimeCode(dependency, MFVersion.MF2, options);
      
      expect(code).toContain('Semver utilities');
      expect(code).toContain('Fallback URLs');
      expect(code).toContain('SSR utilities');
      expect(code).toContain('CircuitBreaker');
      expect(code).toContain('zephyr-retry-plugin');
      expect(code).toContain('zephyr-semver-plugin');
    });
  });
  
  describe('Plugin Factories', () => {
    it('should create a retry plugin with custom config', () => {
      const plugin = createRetryPlugin({
        fetch: {
          retryTimes: 5,
          retryDelay: 1000,
          fallback: 'https://cdn.example.com/fallback.js'
        },
        script: {
          retryTimes: 3,
          moduleName: ['app1', 'app2']
        }
      });
      
      expect(plugin.name).toBe('zephyr-retry-plugin');
      expect(plugin.beforeRequest).toBeDefined();
      expect(plugin.errorLoadRemote).toBeDefined();
      
      // Test plugin behavior
      const requestArgs = { url: 'test.js', moduleName: 'app1' };
      const resultArgs = plugin.beforeRequest!(requestArgs);
      
      expect(resultArgs.retry).toBeDefined();
      expect(resultArgs.retry.times).toBe(3);
    });
    
    it('should create a semver plugin with custom config', () => {
      const plugin = createSemverPlugin({
        strictVersionCheck: true,
        registryUrl: 'https://registry.example.com',
        defaultRequirements: {
          'app1': '^1.0.0',
          'app2': '~2.0.0'
        }
      });
      
      expect(plugin.name).toBe('zephyr-semver-plugin');
      expect(plugin.beforeRequest).toBeDefined();
      expect(plugin.afterResolve).toBeDefined();
      
      // Test plugin behavior
      const requestArgs = { url: 'test.js', moduleName: 'app1' };
      const resultArgs = plugin.beforeRequest!(requestArgs);
      
      expect(resultArgs.versionRequirement).toBe('^1.0.0');
    });
    
    it('should create an SSR plugin with custom config', () => {
      const plugin = createSSRPlugin({
        preloadRemotes: true,
        hydrateOnLoad: true,
        streamingEnabled: true
      });
      
      expect(plugin.name).toBe('zephyr-ssr-plugin');
      expect(plugin.beforeInit).toBeDefined();
      expect(plugin.onLoad).toBeDefined();
      
      // Test plugin behavior
      const initArgs = {};
      const resultArgs = plugin.beforeInit!(initArgs);
      
      // In browser environment, isSSR should be false
      expect(resultArgs.isSSR).toBe(false);
    });
  });
});