# Runtime Plugin System Design

This document outlines the design for a comprehensive runtime plugin system to support Module Federation 2.0 plugins in Zephyr packages.

## Overview

The Module Federation 2.0 runtime plugin system provides a powerful way to extend and customize the behavior of federated modules at runtime. This design document details how Zephyr will implement support for this plugin system, allowing users to:

1. Define custom plugins for handling various aspects of module loading
2. Register plugins at build time or runtime
3. Use plugins to handle failures, retries, alternative sources, and more
4. Extend the federation system with custom behavior

## Plugin Lifecycle Hooks

MF 2.0 provides several lifecycle hooks that plugins can implement:

```
┌─────────────────────────────────┐
│         Federation Init          │
└───────────────┬─────────────────┘
                │
                ▼
┌─────────────────────────────────┐
│          beforeInit             │
└───────────────┬─────────────────┘
                │
                ▼
┌─────────────────────────────────┐
│      Initialize Federation      │
└───────────────┬─────────────────┘
                │
                ▼
┌─────────────────────────────────┐
│     Remote Module Requested     │
└───────────────┬─────────────────┘
                │
                ▼
┌─────────────────────────────────┐
│         beforeRequest           │
└───────────────┬─────────────────┘
                │
                ▼
┌─────────────────────────────────┐
│       Resolve Remote Entry      │
└───────────────┬─────────────────┘
                │
                ┌─────────────────┐
                │     Error?      │───Yes──►┌─────────────────┐
                └────────┬────────┘         │ errorLoadRemote │
                         │No                └────────┬────────┘
                         ▼                           │
┌─────────────────────────────────┐                  │
│          afterResolve           │◄─────────────────┘
└───────────────┬─────────────────┘
                │
                ▼
┌─────────────────────────────────┐
│       Load Remote Module        │
└───────────────┬─────────────────┘
                │
                ▼
┌─────────────────────────────────┐
│             onLoad              │
└─────────────────────────────────┘
```

### Hook Definitions

The plugin system will support the following hooks:

1. **beforeInit**: Called before federation initialization
   - Can modify container options and plugin configurations
   - Sets up global state or integrations

2. **beforeRequest**: Called before resolving a remote container
   - Can modify the request parameters
   - Can implement caching or alternative resolution strategies

3. **afterResolve**: Called after a container is resolved
   - Can post-process the container
   - Can implement additional validation or transformations

4. **onLoad**: Called when a module is loaded
   - Can access the exported content
   - Can implement transformations or monitoring

5. **errorLoadRemote**: Called when loading a remote container fails
   - Can implement retry or fallback strategies
   - Can provide alternative error handling

6. **beforeLoadShare**: Called before loading a shared module
   - Can modify the shared module loading process
   - Can implement custom shared module strategies

7. **createScript**: Called when creating a script element for loading
   - Can customize how scripts are loaded
   - Can add attributes or monitoring

## Plugin Interface

```typescript
interface ZephyrRuntimePlugin {
  /**
   * Unique name for the plugin
   */
  name: string;

  /**
   * Called before federation initialization
   */
  beforeInit?(options: InitOptions): InitOptions | Promise<InitOptions>;

  /**
   * Called before resolving a remote container
   */
  beforeRequest?(args: RequestArgs): RequestArgs | Promise<RequestArgs>;

  /**
   * Called after a container is resolved
   */
  afterResolve?(args: ResolveArgs): ResolveArgs | Promise<ResolveArgs>;

  /**
   * Called when a module is loaded
   */
  onLoad?(args: LoadArgs): LoadArgs | Promise<LoadArgs>;

  /**
   * Called when loading a remote container fails
   */
  errorLoadRemote?(args: ErrorArgs): ErrorArgs | Promise<ErrorArgs>;

  /**
   * Called before loading a shared module
   */
  beforeLoadShare?(args: ShareArgs): ShareArgs | Promise<ShareArgs>;

  /**
   * Called when creating a script element for loading
   */
  createScript?(args: ScriptArgs): ScriptArgs | Promise<ScriptArgs>;
}
```

### Hook Arguments

Each hook receives specific arguments relevant to its phase:

```typescript
interface InitOptions {
  name: string;
  remotes?: Record<string, string | RemoteConfig>;
  shared?: Record<string, ShareConfig>;
  plugins?: ZephyrRuntimePlugin[];
}

interface RequestArgs {
  url: string;
  moduleName: string;
  options?: Record<string, any>;
  retry?: { times: number; delay: number };
}

interface ResolveArgs {
  container: any;
  url: string;
  moduleName: string;
}

interface LoadArgs {
  module: any;
  moduleName: string;
  container: any;
}

interface ErrorArgs {
  error: Error;
  url: string;
  moduleName: string;
  retryUrl?: string;
  retryCount?: number;
}

interface ShareArgs {
  name: string;
  version: string;
  options: ShareConfig;
}

interface ScriptArgs {
  url: string;
  scriptElement: HTMLScriptElement;
  attributes?: Record<string, string>;
}
```

## Plugin Registration

Plugins can be registered in several ways:

### 1. Build-time Registration

Through webpack/rspack plugin configuration:

```javascript
// webpack.config.js
const { withZephyr } = require('@zephyr/webpack-plugin');

module.exports = withZephyr({
  // ... other webpack config
  plugins: [
    new ModuleFederationPlugin({
      // ... federation config
      runtimePlugins: [
        path.resolve(__dirname, './plugins/retry-plugin.js'),
        path.resolve(__dirname, './plugins/fallback-plugin.js')
      ]
    })
  ]
});
```

### 2. Runtime Registration

Directly in application code:

```javascript
// index.js
import { registerPlugins } from '@zephyr/runtime';
import retryPlugin from './plugins/retry-plugin';
import fallbackPlugin from './plugins/fallback-plugin';

registerPlugins([
  retryPlugin({ retryTimes: 3 }),
  fallbackPlugin({ fallbackUrl: 'https://fallback.example.com' })
]);
```

### 3. Global Registration

For plugins that should apply to all federation containers:

```javascript
// index.js
import { registerGlobalPlugins } from '@zephyr/runtime';
import monitoringPlugin from './plugins/monitoring-plugin';

registerGlobalPlugins([
  monitoringPlugin()
]);
```

## Plugin Execution Flow

1. Plugins are collected during initialization
2. For each hook, plugins are executed in registration order
3. Each plugin can modify the arguments passed to the next plugin
4. The final arguments are used for the actual operation
5. Hooks can be asynchronous (returning Promises)

```
Plugin1.beforeInit → Plugin2.beforeInit → ... → Actual Init
```

## Standard Plugin Types

The implementation will include several standard plugins:

### 1. Retry Plugin

Handles retry logic for failed remote loading:

```typescript
interface RetryPluginOptions {
  fetch?: {
    retryTimes?: number;
    retryDelay?: number;
    url?: string;
    fallback?: string | (() => string);
  };
  script?: {
    retryTimes?: number;
    retryDelay?: number;
    moduleName?: string[];
  };
}

function createRetryPlugin(options: RetryPluginOptions): ZephyrRuntimePlugin {
  return {
    name: 'zephyr-retry-plugin',
    
    beforeRequest(args) {
      // Add retry configuration
      return args;
    },
    
    errorLoadRemote(args) {
      // Implement retry logic
      return args;
    }
  };
}
```

### 2. Fallback Plugin

Provides alternative sources for remotes:

```typescript
interface FallbackPluginOptions {
  remotes?: Record<string, string | string[]>;
  defaultFallback?: string;
  timeout?: number;
}

function createFallbackPlugin(options: FallbackPluginOptions): ZephyrRuntimePlugin {
  return {
    name: 'zephyr-fallback-plugin',
    
    errorLoadRemote(args) {
      // Provide fallback URL
      return args;
    }
  };
}
```

### 3. Shared Strategy Plugin

Customizes shared module loading strategy:

```typescript
type SharedStrategy = 'highest-version' | 'lowest-version' | 'loaded-first' | 'host-first';

interface SharedStrategyPluginOptions {
  strategy: SharedStrategy;
  moduleSpecificStrategies?: Record<string, SharedStrategy>;
}

function createSharedStrategyPlugin(options: SharedStrategyPluginOptions): ZephyrRuntimePlugin {
  return {
    name: 'zephyr-shared-strategy-plugin',
    
    beforeLoadShare(args) {
      // Implement custom sharing strategy
      return args;
    }
  };
}
```

### 4. Preload Plugin

Optimizes loading performance through preloading:

```typescript
interface PreloadPluginOptions {
  preloadAll?: boolean;
  specificModules?: string[];
  preloadStrategy?: 'eager' | 'lazy';
}

function createPreloadPlugin(options: PreloadPluginOptions): ZephyrRuntimePlugin {
  return {
    name: 'zephyr-preload-plugin',
    
    beforeInit(args) {
      // Set up preloading
      return args;
    },
    
    afterResolve(args) {
      // Trigger preloading of related modules
      return args;
    }
  };
}
```

## Integration with Zephyr

The runtime plugin system will be integrated with Zephyr in several ways:

### 1. Runtime Generation

```typescript
function createMfRuntimeCode(
  deps: ZeResolvedDependency,
  mfVersion: MFVersion,
  plugins?: Array<ZephyrRuntimePlugin>
): string {
  const basicCode = mfVersion === MFVersion.MF2
    ? createMF2RuntimeCode(deps)
    : createMF1RuntimeCode(deps);
  
  // If no plugins, return basic code
  if (!plugins || plugins.length === 0) {
    return basicCode;
  }
  
  // Add plugin registration code
  return `
${basicCode}

// Register Zephyr runtime plugins
(function() {
  const plugins = [
${plugins.map(plugin => `    ${JSON.stringify(plugin)}`).join(',\n')}
  ];
  
  if (typeof window !== 'undefined' && window.__ZEPHYR_FEDERATION__) {
    if (typeof window.__ZEPHYR_FEDERATION__.registerPlugins === 'function') {
      window.__ZEPHYR_FEDERATION__.registerPlugins(plugins);
    }
  }
})();
`;
}
```

### 2. Plugin Configuration

Add plugin configuration to Zephyr plugin options:

```typescript
interface ZephyrPluginOptions {
  // Existing options
  
  // New plugin options
  runtimePlugins?: Array<string | ZephyrRuntimePlugin>;
  pluginOptions?: {
    retry?: RetryPluginOptions;
    fallback?: FallbackPluginOptions;
    sharedStrategy?: SharedStrategyPluginOptions;
    preload?: PreloadPluginOptions;
    [pluginName: string]: any;
  };
}
```

### 3. Plugin Discovery

Implement a mechanism to discover and load plugins from configuration:

```typescript
function loadPluginsFromConfig(config: ZephyrPluginOptions): ZephyrRuntimePlugin[] {
  const plugins: ZephyrRuntimePlugin[] = [];
  
  // Add plugins from direct configuration
  if (config.runtimePlugins) {
    for (const plugin of config.runtimePlugins) {
      if (typeof plugin === 'string') {
        // Load plugin from path
        const loadedPlugin = requirePlugin(plugin);
        plugins.push(loadedPlugin);
      } else {
        // Use inline plugin definition
        plugins.push(plugin);
      }
    }
  }
  
  // Add standard plugins based on configuration
  if (config.pluginOptions?.retry) {
    plugins.push(createRetryPlugin(config.pluginOptions.retry));
  }
  
  if (config.pluginOptions?.fallback) {
    plugins.push(createFallbackPlugin(config.pluginOptions.fallback));
  }
  
  if (config.pluginOptions?.sharedStrategy) {
    plugins.push(createSharedStrategyPlugin(config.pluginOptions.sharedStrategy));
  }
  
  if (config.pluginOptions?.preload) {
    plugins.push(createPreloadPlugin(config.pluginOptions.preload));
  }
  
  return plugins;
}
```

## Runtime Implementation

The runtime plugin system will be implemented as part of the federation runtime:

```typescript
class PluginSystem {
  private plugins: ZephyrRuntimePlugin[] = [];
  
  /**
   * Register plugins
   */
  registerPlugins(plugins: ZephyrRuntimePlugin[]): void {
    this.plugins.push(...plugins);
  }
  
  /**
   * Execute a hook across all plugins
   */
  async executeHook<T>(hookName: keyof ZephyrRuntimePlugin, args: T): Promise<T> {
    let result = args;
    
    for (const plugin of this.plugins) {
      const hook = plugin[hookName];
      if (typeof hook === 'function') {
        result = await Promise.resolve(hook.call(plugin, result));
      }
    }
    
    return result;
  }
}

class FederationRuntime {
  private pluginSystem = new PluginSystem();
  
  /**
   * Initialize federation with plugins
   */
  async init(options: InitOptions): Promise<void> {
    // Register built-in plugins
    if (options.plugins) {
      this.pluginSystem.registerPlugins(options.plugins);
    }
    
    // Execute beforeInit hook
    const modifiedOptions = await this.pluginSystem.executeHook('beforeInit', options);
    
    // Actual initialization with modified options
    // ...
  }
  
  /**
   * Load a remote module
   */
  async loadRemote(moduleName: string, url: string): Promise<any> {
    try {
      // Execute beforeRequest hook
      const requestArgs = await this.pluginSystem.executeHook('beforeRequest', {
        moduleName,
        url
      });
      
      // Resolve container
      const container = await this.resolveContainer(requestArgs.url);
      
      // Execute afterResolve hook
      const resolveArgs = await this.pluginSystem.executeHook('afterResolve', {
        container,
        moduleName: requestArgs.moduleName,
        url: requestArgs.url
      });
      
      // Load module from container
      const module = await this.loadModuleFromContainer(
        resolveArgs.container,
        resolveArgs.moduleName
      );
      
      // Execute onLoad hook
      const loadArgs = await this.pluginSystem.executeHook('onLoad', {
        module,
        moduleName: resolveArgs.moduleName,
        container: resolveArgs.container
      });
      
      return loadArgs.module;
    } catch (error) {
      // Execute errorLoadRemote hook
      const errorArgs = await this.pluginSystem.executeHook('errorLoadRemote', {
        error,
        moduleName,
        url
      });
      
      // Check if a retry URL was provided
      if (errorArgs.retryUrl) {
        return this.loadRemote(moduleName, errorArgs.retryUrl);
      }
      
      throw errorArgs.error;
    }
  }
  
  // Other methods...
}
```

## Testing Strategy

A comprehensive testing strategy will be implemented for the plugin system:

### 1. Mock Federation Runtime

```typescript
class MockFederationRuntime {
  private pluginSystem = new PluginSystem();
  
  registerPlugins(plugins: ZephyrRuntimePlugin[]): void {
    this.pluginSystem.registerPlugins(plugins);
  }
  
  async simulateBeforeInit(options: InitOptions): Promise<InitOptions> {
    return this.pluginSystem.executeHook('beforeInit', options);
  }
  
  async simulateError(error: Error, moduleName: string, url: string): Promise<ErrorArgs> {
    return this.pluginSystem.executeHook('errorLoadRemote', {
      error,
      moduleName,
      url
    });
  }
  
  // Other simulation methods...
}
```

### 2. Test Fixtures

```typescript
const testInitOptions = {
  name: 'test-container',
  remotes: {
    'remote1': 'https://example.com/remote1'
  },
  shared: {
    'react': { singleton: true, requiredVersion: '^18.0.0' }
  }
};

const testError = new Error('Failed to load remote');

const testPlugin = {
  name: 'test-plugin',
  beforeInit(options) {
    return {
      ...options,
      modified: true
    };
  },
  errorLoadRemote(args) {
    return {
      ...args,
      retryUrl: 'https://fallback.example.com'
    };
  }
};
```

### 3. Test Cases

```typescript
describe('Plugin System', () => {
  let runtime: MockFederationRuntime;
  
  beforeEach(() => {
    runtime = new MockFederationRuntime();
  });
  
  it('should modify init options', async () => {
    runtime.registerPlugins([testPlugin]);
    
    const result = await runtime.simulateBeforeInit(testInitOptions);
    
    expect(result.modified).toBe(true);
    expect(result.name).toBe(testInitOptions.name);
  });
  
  it('should provide retry URL on error', async () => {
    runtime.registerPlugins([testPlugin]);
    
    const result = await runtime.simulateError(
      testError,
      'remote1',
      'https://example.com/remote1'
    );
    
    expect(result.retryUrl).toBe('https://fallback.example.com');
    expect(result.error).toBe(testError);
  });
  
  // More tests...
});
```

## Integration Examples

### Example 1: Custom Error Handling

```typescript
// custom-error-plugin.js
module.exports = function createCustomErrorPlugin() {
  return {
    name: 'custom-error-plugin',
    
    errorLoadRemote(args) {
      // Log error to monitoring service
      console.error(`Failed to load ${args.moduleName} from ${args.url}`, args.error);
      
      // Provide fallback content for specific module
      if (args.moduleName === 'Header') {
        return {
          ...args,
          module: {
            default: () => ({
              type: 'div',
              props: {
                children: 'Fallback Header'
              }
            })
          }
        };
      }
      
      return args;
    }
  };
}
```

### Example 2: Custom Shared Module Strategy

```typescript
// host-preference-plugin.js
module.exports = function createHostPreferencePlugin() {
  return {
    name: 'host-preference-plugin',
    
    beforeLoadShare(args) {
      // Always prefer the host's version of React
      if (args.name === 'react') {
        return {
          ...args,
          options: {
            ...args.options,
            strategy: 'host-first'
          }
        };
      }
      
      return args;
    }
  };
}
```

### Example 3: Performance Monitoring

```typescript
// monitoring-plugin.js
module.exports = function createMonitoringPlugin() {
  const loadTimes = new Map();
  
  return {
    name: 'monitoring-plugin',
    
    beforeRequest(args) {
      loadTimes.set(args.moduleName, Date.now());
      return args;
    },
    
    onLoad(args) {
      const startTime = loadTimes.get(args.moduleName);
      const loadTime = Date.now() - startTime;
      
      console.log(`Module ${args.moduleName} loaded in ${loadTime}ms`);
      
      // Send telemetry
      if (window.performance && window.performance.mark) {
        window.performance.mark(`mf-load-${args.moduleName}`);
      }
      
      return args;
    }
  };
}
```

## Conclusion

This comprehensive runtime plugin system will enable Zephyr to fully leverage the capabilities of Module Federation 2.0 plugins while maintaining backward compatibility with existing implementations. The system provides:

1. A flexible hook-based architecture for extending federation behavior
2. Standard plugins for common needs like retries, fallbacks, and performance optimization
3. Integration with Zephyr's configuration and runtime systems
4. A testing framework for plugin development and validation

This design serves as the foundation for implementing Phase 1.3 of the Zephyr packages update plan.