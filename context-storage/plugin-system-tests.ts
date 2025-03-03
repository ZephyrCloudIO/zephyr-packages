/**
 * Plugin System Tests
 * 
 * This file contains tests and usage examples for the Zephyr runtime plugin system.
 */

import {
  init,
  registerPlugins,
  loadRemote,
  createRetryPlugin,
  createFallbackPlugin,
  ZephyrRuntimePlugin,
  FederationRuntime,
  PluginSystem,
  InitOptions,
  ErrorArgs
} from './runtime-plugin-system-implementation';

import {
  ZephyrPlugins,
  CircuitState
} from './common-plugins-implementation';

/**
 * Basic Plugin System Tests
 */
function testPluginSystem(): void {
  console.log('Testing Plugin System...');
  
  const pluginSystem = new PluginSystem();
  
  // Create test plugins
  const testPlugin1: ZephyrRuntimePlugin = {
    name: 'test-plugin-1',
    beforeInit: (options) => {
      console.log('Plugin 1: beforeInit called');
      options.customField = 'added by plugin 1';
      return options;
    }
  };
  
  const testPlugin2: ZephyrRuntimePlugin = {
    name: 'test-plugin-2',
    beforeInit: (options) => {
      console.log('Plugin 2: beforeInit called');
      options.anotherField = 'added by plugin 2';
      return options;
    },
    errorLoadRemote: (args) => {
      console.log('Plugin 2: errorLoadRemote called');
      return {
        ...args,
        retryUrl: 'https://fallback.example.com'
      };
    }
  };
  
  // Register plugins
  pluginSystem.registerPlugins([testPlugin1, testPlugin2]);
  
  // Execute a hook
  pluginSystem.executeHook('beforeInit', { name: 'test' })
    .then(result => {
      console.log('Hook execution result:', result);
    });
  
  // Get plugins
  const plugins = pluginSystem.getPlugins();
  console.log(`Registered ${plugins.length} plugins`);
  
  // Get a specific plugin
  const plugin2 = pluginSystem.getPluginByName('test-plugin-2');
  console.log('Found plugin 2:', plugin2 ? 'Yes' : 'No');
}

/**
 * Federation Runtime Tests
 */
async function testFederationRuntime(): Promise<void> {
  console.log('\nTesting Federation Runtime...');
  
  const runtime = new FederationRuntime();
  
  // Create test plugins
  const loggingPlugin: ZephyrRuntimePlugin = {
    name: 'logging-plugin',
    beforeInit: (options) => {
      console.log('Initializing federation with options:', options);
      return options;
    },
    beforeRequest: (args) => {
      console.log(`Loading module ${args.moduleName} from ${args.url}`);
      return args;
    },
    afterResolve: (args) => {
      console.log(`Resolved container for ${args.moduleName}`);
      return args;
    },
    onLoad: (args) => {
      console.log(`Loaded module ${args.moduleName}`);
      return args;
    }
  };
  
  // Register plugin
  runtime.registerPlugins([loggingPlugin]);
  
  // Initialize
  await runtime.init({
    name: 'test-app',
    remotes: {
      'remote1': 'https://example.com/remote1'
    }
  });
  
  // Try to load a remote (simulated)
  try {
    await runtime.loadRemote('RemoteComponent', 'https://example.com/remote1/remoteEntry.js');
    console.log('Remote loaded successfully');
  } catch (error) {
    console.error('Error loading remote:', error);
  }
}

/**
 * Retry Plugin Tests
 */
async function testRetryPlugin(): Promise<void> {
  console.log('\nTesting Retry Plugin...');
  
  const runtime = new FederationRuntime();
  
  // Create retry plugin
  const retryPlugin = createRetryPlugin({
    fetch: {
      retryTimes: 2,
      retryDelay: 100
    },
    script: {
      retryTimes: 3,
      moduleName: ['RetryableComponent']
    }
  });
  
  // Create test plugin that tracks retry attempts
  const monitorPlugin: ZephyrRuntimePlugin = {
    name: 'monitor-plugin',
    beforeRequest: (args) => {
      console.log(`Request: ${args.moduleName}, Retry config:`, args.retry);
      return args;
    },
    errorLoadRemote: (args) => {
      console.log(`Error loading ${args.moduleName}, Retry URL:`, args.retryUrl);
      return args;
    }
  };
  
  // Register plugins
  runtime.registerPlugins([retryPlugin, monitorPlugin]);
  
  // Initialize
  await runtime.init({
    name: 'retry-test-app'
  });
  
  // Simulate errors to test retry
  try {
    await runtime.loadRemote('RetryableComponent', 'https://example.com/broken-url.js');
  } catch (error) {
    console.log('Error after retries:', error.message);
  }
}

/**
 * Advanced Plugins Tests
 */
async function testAdvancedPlugins(): Promise<void> {
  console.log('\nTesting Advanced Plugins...');
  
  // Create special mock runtime for testing purposes
  class MockRuntime extends FederationRuntime {
    // Override loadRemote to simulate different scenarios
    async loadRemote(moduleName: string, url: string): Promise<any> {
      // Inject error for specific modules to test various plugins
      if (moduleName === 'ErrorComponent') {
        throw new Error('Simulated error loading module');
      }
      
      if (moduleName === 'CircuitComponent') {
        // First 5 calls will fail, then succeed
        const failCount = this.getFailCount(moduleName);
        if (failCount < 5) {
          this.incrementFailCount(moduleName);
          throw new Error('Temporary service unavailable');
        }
      }
      
      // Simulate successful loading
      return { default: {} };
    }
    
    // Failure tracking for tests
    private failCounts = new Map<string, number>();
    
    private getFailCount(moduleName: string): number {
      return this.failCounts.get(moduleName) || 0;
    }
    
    private incrementFailCount(moduleName: string): void {
      const count = this.getFailCount(moduleName);
      this.failCounts.set(moduleName, count + 1);
    }
  }
  
  const runtime = new MockRuntime();
  
  // Create advanced retry plugin
  const retryPlugin = ZephyrPlugins.retry({
    maxRetries: 2,
    initialDelay: 50,
    jitter: 0.2,
    onRetry: (attempt, delay, error) => {
      console.log(`Retry ${attempt}: ${error.message} (delay: ${delay}ms)`);
    }
  });
  
  // Create circuit breaker plugin
  const circuitPlugin = ZephyrPlugins.circuitBreaker({
    failureThreshold: 3,
    resetTimeout: 500,
    onOpen: (moduleName) => {
      console.log(`Circuit OPEN for ${moduleName}`);
    },
    onHalfOpen: (moduleName) => {
      console.log(`Circuit HALF-OPEN for ${moduleName}`);
    },
    onClose: (moduleName) => {
      console.log(`Circuit CLOSED for ${moduleName}`);
    }
  });
  
  // Create versioning plugin
  const versionPlugin = ZephyrPlugins.versioning({
    versionOverrides: {
      'react': '^18.0.0',
      'react-dom': '^18.0.0'
    },
    onVersionConflict: (moduleName, requested, available) => {
      console.log(`Version conflict for ${moduleName}: requested ${requested}, available ${available}`);
    }
  });
  
  // Register plugins
  runtime.registerPlugins([retryPlugin, circuitPlugin, versionPlugin]);
  
  // Initialize
  await runtime.init({
    name: 'advanced-test-app',
    shared: {
      'react': {
        singleton: true,
        requiredVersion: '^17.0.0'
      }
    }
  });
  
  // Test error component with retry
  try {
    console.log('\nTesting error with retry:');
    await runtime.loadRemote('ErrorComponent', 'https://example.com/error-component.js');
  } catch (error) {
    console.log('Final error:', error.message);
  }
  
  // Test circuit breaker
  console.log('\nTesting circuit breaker:');
  
  // First few calls should fail and open the circuit
  for (let i = 0; i < 4; i++) {
    try {
      await runtime.loadRemote('CircuitComponent', 'https://example.com/circuit-component.js');
      console.log('Call succeeded');
    } catch (error) {
      console.log(`Call ${i + 1} failed: ${error.message}`);
    }
  }
  
  // Wait for circuit to go to half-open
  console.log('Waiting for circuit reset...');
  await new Promise(resolve => setTimeout(resolve, 600));
  
  // This call should succeed
  try {
    await runtime.loadRemote('CircuitComponent', 'https://example.com/circuit-component.js');
    console.log('Call succeeded after circuit reset');
  } catch (error) {
    console.log('Call failed after circuit reset:', error.message);
  }
}

/**
 * Plugin Composition Tests
 */
async function testPluginComposition(): Promise<void> {
  console.log('\nTesting Plugin Composition...');
  
  const runtime = new FederationRuntime();
  
  // Create a chain of plugins that enhance each other
  const plugin1: ZephyrRuntimePlugin = {
    name: 'plugin1',
    beforeRequest: (args) => {
      console.log('Plugin 1: Adding request ID');
      return {
        ...args,
        requestId: 'req-123'
      };
    }
  };
  
  const plugin2: ZephyrRuntimePlugin = {
    name: 'plugin2',
    beforeRequest: (args) => {
      console.log(`Plugin 2: Request ID ${args.requestId}, adding timestamp`);
      return {
        ...args,
        timestamp: Date.now()
      };
    }
  };
  
  const plugin3: ZephyrRuntimePlugin = {
    name: 'plugin3',
    beforeRequest: (args) => {
      console.log(`Plugin 3: Request ID ${args.requestId}, Timestamp ${args.timestamp}`);
      console.log('Final request args:', args);
      return args;
    }
  };
  
  // Register plugins in order
  runtime.registerPlugins([plugin1, plugin2, plugin3]);
  
  // Initialize
  await runtime.init({
    name: 'composition-test-app'
  });
  
  // Execute chain
  try {
    await runtime.loadRemote('TestComponent', 'https://example.com/test-component.js');
  } catch (error) {
    // Expected error since we're just testing the hooks
    console.log('Finished plugin chain execution');
  }
}

/**
 * Custom Error Handling Tests
 */
async function testCustomErrorHandling(): Promise<void> {
  console.log('\nTesting Custom Error Handling...');
  
  const runtime = new FederationRuntime();
  
  // Create a custom error handling plugin
  const errorHandlerPlugin: ZephyrRuntimePlugin = {
    name: 'error-handler',
    errorLoadRemote: (args: ErrorArgs) => {
      console.log(`Error loading ${args.moduleName}: ${args.error.message}`);
      
      // Provide fallback module for specific components
      if (args.moduleName === 'HeaderComponent') {
        console.log('Providing fallback HeaderComponent');
        return {
          ...args,
          module: {
            default: {
              displayName: 'FallbackHeader',
              render: () => 'Fallback Header'
            }
          }
        };
      }
      
      // For other modules, try an alternative URL
      if (args.url.includes('primary')) {
        console.log('Switching to secondary URL');
        return {
          ...args,
          retryUrl: args.url.replace('primary', 'secondary')
        };
      }
      
      return args;
    }
  };
  
  // Register plugin
  runtime.registerPlugins([errorHandlerPlugin]);
  
  // Initialize
  await runtime.init({
    name: 'error-handling-test-app'
  });
  
  // Test with HeaderComponent
  try {
    const result = await runtime.loadRemote('HeaderComponent', 'https://example.com/primary/header.js');
    console.log('HeaderComponent loaded:', result.default.displayName);
  } catch (error) {
    console.log('Failed to load HeaderComponent:', error.message);
  }
  
  // Test with another component
  try {
    await runtime.loadRemote('FooterComponent', 'https://example.com/primary/footer.js');
    console.log('FooterComponent loaded');
  } catch (error) {
    console.log('Failed to load FooterComponent:', error.message);
  }
}

/**
 * Run all tests
 */
async function runTests(): Promise<void> {
  console.log('=== ZEPHYR RUNTIME PLUGIN SYSTEM TESTS ===\n');
  
  testPluginSystem();
  await testFederationRuntime();
  await testRetryPlugin();
  await testAdvancedPlugins();
  await testPluginComposition();
  await testCustomErrorHandling();
  
  console.log('\n=== TESTS COMPLETED ===');
}

// Run the tests
runTests().catch(console.error);