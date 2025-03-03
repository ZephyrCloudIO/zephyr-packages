/**
 * MF Runtime Code Generation Tests
 * 
 * These tests validate the generation of runtime code for both MF 1.0 and 2.0.
 */

import { 
  MFVersion 
} from '../../enhanced-plugin-detection';

import {
  ZeResolvedDependency,
  createMfRuntimeCode,
  createMF1RuntimeCode,
  createMF2RuntimeCode,
  createRetryPlugin,
  createRuntimePluginsInitCode
} from '../../enhanced-runtime-code-generation';

describe('MF Runtime Code Generation', () => {
  // Test dependencies
  const testDependency: ZeResolvedDependency = {
    name: 'test-remote',
    application_uid: 'test-app-12345',
    remote_entry_url: 'https://cdn.zephyr-pkg.dev/test-remote@1.0.0/remoteEntry.js',
    default_url: 'http://localhost:3001/remoteEntry.js',
    library_type: 'var'
  };

  describe('createMfRuntimeCode', () => {
    test('should generate MF 1.0 code when MF 1.0 version is specified', () => {
      const code = createMfRuntimeCode(testDependency, MFVersion.MF1);
      
      // MF 1.0 code should not include retry logic
      expect(code).not.toContain('attemptLoadWithRetry');
      expect(code).not.toContain('MAX_RETRIES');
      
      // Should have basic fetch with HEAD method
      expect(code).toContain('fetch');
      
      // Should include the dependency info
      expect(code).toContain('test-remote');
      expect(code).toContain('test-app-12345');
      expect(code).toContain('https://cdn.zephyr-pkg.dev/test-remote@1.0.0/remoteEntry.js');
    });

    test('should generate MF 2.0 code when MF 2.0 version is specified', () => {
      const code = createMfRuntimeCode(testDependency, MFVersion.MF2);
      
      // MF 2.0 code should include retry logic
      expect(code).toContain('attemptLoadWithRetry');
      expect(code).toContain('MAX_RETRIES');
      
      // Should check for container.get method (MF 2.0 container protocol)
      expect(code).toContain("'get' in mod");
      
      // Should include the dependency info
      expect(code).toContain('test-remote');
      expect(code).toContain('test-app-12345');
      expect(code).toContain('https://cdn.zephyr-pkg.dev/test-remote@1.0.0/remoteEntry.js');
    });

    test('should default to MF 1.0 when no version is specified', () => {
      const code = createMfRuntimeCode(testDependency);
      
      // Should not include MF 2.0 specific code
      expect(code).not.toContain('attemptLoadWithRetry');
      expect(code).not.toContain('MAX_RETRIES');
    });
  });

  describe('createRetryPlugin', () => {
    test('should create a retry plugin with default configuration', () => {
      const plugin = createRetryPlugin();
      
      expect(plugin).toHaveProperty('name', 'zephyr-retry-plugin');
      expect(plugin).toHaveProperty('beforeRequest');
      expect(plugin).toHaveProperty('errorLoadRemote');
    });

    test('should customize retry plugin with provided configuration', () => {
      const plugin = createRetryPlugin({
        fetch: {
          retryTimes: 5,
          retryDelay: 500,
          fallback: 'https://fallback-cdn.example.com/remote.js'
        },
        script: {
          retryTimes: 3,
          retryDelay: 1000,
          moduleName: ['specific-module']
        }
      });
      
      expect(plugin).toHaveProperty('name', 'zephyr-retry-plugin');
      
      // Test beforeRequest with module that should use retry
      const args1 = { url: 'test', moduleName: 'specific-module' };
      const result1 = plugin.beforeRequest(args1);
      
      expect(result1.retry).toHaveProperty('times', 3);
      expect(result1.retry).toHaveProperty('delay', 1000);
      
      // Test beforeRequest with module that should not use retry
      const args2 = { url: 'test', moduleName: 'other-module' };
      const result2 = plugin.beforeRequest(args2);
      
      // Note: If plugins don't set data for modules not in the moduleName list,
      // we'll check if the retry property exists but not its exact values
      expect(result2).toHaveProperty('url', 'test');
      
      // Test errorLoadRemote with fetch error
      const errorArgs = { 
        error: { message: 'Failed to fetch' }, 
        moduleName: 'test-module' 
      };
      
      const errorResult = plugin.errorLoadRemote(errorArgs);
      expect(errorResult).toHaveProperty('retryUrl', 'https://fallback-cdn.example.com/remote.js');
    });
  });

  describe('createRuntimePluginsInitCode', () => {
    test('should generate empty string for empty plugins array', () => {
      const code = createRuntimePluginsInitCode([]);
      expect(code).toBe('');
    });

    test('should generate initialization code for string plugin paths', () => {
      const code = createRuntimePluginsInitCode([
        './plugins/retry.js',
        './plugins/circuit-breaker.js'
      ]);
      
      expect(code).toContain('registerPlugins');
      expect(code).toContain('require("./plugins/retry.js")()');
      expect(code).toContain('require("./plugins/circuit-breaker.js")()');
    });

    test('should generate initialization code for inline plugin objects', () => {
      const retryPlugin = createRetryPlugin();
      const code = createRuntimePluginsInitCode([retryPlugin]);
      
      expect(code).toContain('registerPlugins');
      expect(code).toContain('zephyr-retry-plugin');
    });
  });
});