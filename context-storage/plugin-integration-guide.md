# Zephyr Runtime Plugin Integration Guide

This guide explains how to integrate and use the runtime plugin system in your Zephyr-enabled applications.

## Table of Contents

- [Introduction](#introduction)
- [Plugin Types](#plugin-types)
- [Adding Plugins to Your Application](#adding-plugins-to-your-application)
- [Creating Custom Plugins](#creating-custom-plugins)
- [Plugin Lifecycle Hooks](#plugin-lifecycle-hooks)
- [Common Use Cases](#common-use-cases)
- [Advanced Topics](#advanced-topics)
- [Troubleshooting](#troubleshooting)

## Introduction

The Zephyr runtime plugin system allows you to extend and customize the behavior of federated modules at runtime. It provides hooks into various stages of the module loading lifecycle, enabling you to implement features like:

- Retry logic for failed module loading
- Fallback strategies when remotes are unavailable
- Caching for improved performance
- Custom error handling
- Shared module version management
- Telemetry and monitoring

## Plugin Types

Zephyr includes several built-in plugin types:

1. **Retry Plugin**: Handles retry logic with exponential backoff
2. **Fallback Plugin**: Provides alternative sources for remote modules
3. **Circuit Breaker Plugin**: Prevents cascading failures with circuit breaker pattern
4. **Cache Plugin**: Caches module loading results for performance
5. **Versioning Plugin**: Manages shared module versions and conflicts
6. **Monitoring Plugin**: Collects performance and usage data
7. **Telemetry Plugin**: Sends data to monitoring endpoints

## Adding Plugins to Your Application

### Method 1: Build-time Configuration

Add plugins to your webpack/rspack configuration:

```javascript
// webpack.config.js
const { withZephyr } = require('@zephyr/webpack-plugin');
const { createRetryPlugin, createFallbackPlugin } = require('@zephyr/runtime');

module.exports = withZephyr({
  // ... other webpack config
  plugins: [
    new ModuleFederationPlugin({
      name: 'host',
      remotes: {
        remote1: 'remote1@http://localhost:3001/remoteEntry.js'
      },
      // Configure runtime plugins
      runtimePlugins: [
        // Built-in plugins with configuration
        createRetryPlugin({
          fetch: { retryTimes: 3, retryDelay: 500 },
          script: { retryTimes: 2 }
        }),
        createFallbackPlugin({
          remotes: {
            remote1: 'http://fallback.example.com/remote1/remoteEntry.js'
          }
        }),
        // Path to custom plugin file
        path.resolve(__dirname, './src/plugins/custom-plugin.js')
      ]
    })
  ]
});
```

### Method 2: Runtime Registration

Register plugins in your application code:

```javascript
// index.js
import { init, registerPlugins } from '@zephyr/runtime';
import { createRetryPlugin, createMonitoringPlugin } from '@zephyr/runtime/plugins';
import customPlugin from './plugins/custom-plugin';

// Register plugins
registerPlugins([
  createRetryPlugin({ retryTimes: 3 }),
  createMonitoringPlugin({ enableLogs: true }),
  customPlugin()
]);

// Initialize federation
init({
  name: 'host',
  remotes: {
    remote1: 'remote1@http://localhost:3001/remoteEntry.js'
  }
});
```

## Creating Custom Plugins

A plugin is an object with a unique name and one or more lifecycle hook methods:

```javascript
// custom-plugin.js
module.exports = function createCustomPlugin(options = {}) {
  return {
    name: 'my-custom-plugin',
    
    // Called before federation initialization
    beforeInit(options) {
      console.log('Initializing federation with options:', options);
      return options;
    },
    
    // Called before resolving a remote container
    beforeRequest(args) {
      console.log(`Loading module ${args.moduleName} from ${args.url}`);
      return args;
    },
    
    // Called when loading a remote container fails
    errorLoadRemote(args) {
      console.error(`Failed to load ${args.moduleName}:`, args.error);
      
      // Implement custom error handling logic
      if (args.moduleName === 'HeaderComponent') {
        return {
          ...args,
          // Provide a fallback module instead of the real one
          module: createFallbackHeader()
        };
      }
      
      return args;
    }
  };
};

function createFallbackHeader() {
  return {
    default: {
      displayName: 'FallbackHeader',
      render: () => 'This is a fallback header'
    }
  };
}
```

## Plugin Lifecycle Hooks

The plugin system supports these lifecycle hooks:

| Hook | Description | Arguments | Return Value |
|------|-------------|-----------|--------------|
| `beforeInit` | Called before federation initialization | `InitOptions` | `InitOptions` |
| `beforeRequest` | Called before resolving a remote | `RequestArgs` | `RequestArgs` |
| `afterResolve` | Called after a container is resolved | `ResolveArgs` | `ResolveArgs` |
| `onLoad` | Called when a module is loaded | `LoadArgs` | `LoadArgs` |
| `errorLoadRemote` | Called when loading a remote fails | `ErrorArgs` | `ErrorArgs` |
| `beforeLoadShare` | Called before loading a shared module | `ShareArgs` | `ShareArgs` |
| `createScript` | Called when creating a script element | `ScriptArgs` | `ScriptArgs` |

Each hook receives specific arguments and can modify them before passing to the next plugin in the chain. Hooks can be asynchronous (returning a Promise).

## Common Use Cases

### Implementing Error Recovery

The `errorLoadRemote` hook allows you to recover from failures:

```javascript
function createErrorRecoveryPlugin() {
  return {
    name: 'error-recovery-plugin',
    errorLoadRemote(args) {
      const { error, moduleName, url } = args;
      
      // Log the error
      console.error(`Error loading ${moduleName} from ${url}:`, error);
      
      // Check for specific error types
      if (error.message.includes('Failed to fetch')) {
        // Try a fallback URL
        return {
          ...args,
          retryUrl: url.replace('primary', 'backup')
        };
      }
      
      // For specific modules, provide a fallback implementation
      if (moduleName === 'NavigationComponent') {
        return {
          ...args,
          module: {
            default: () => ({
              type: 'nav',
              props: { children: 'Fallback Navigation' }
            })
          }
        };
      }
      
      return args;
    }
  };
}
```

### Performance Monitoring

Collect performance data with the plugin hooks:

```javascript
function createPerformancePlugin() {
  const moduleLoadTimes = new Map();
  
  return {
    name: 'performance-plugin',
    
    beforeRequest(args) {
      moduleLoadTimes.set(args.moduleName, performance.now());
      return args;
    },
    
    onLoad(args) {
      const startTime = moduleLoadTimes.get(args.moduleName);
      if (startTime) {
        const loadTime = performance.now() - startTime;
        console.log(`Module ${args.moduleName} loaded in ${loadTime.toFixed(2)}ms`);
        
        // Send to analytics
        if (typeof window !== 'undefined' && window.analytics) {
          window.analytics.track('ModuleLoaded', {
            moduleName: args.moduleName,
            loadTime: loadTime
          });
        }
        
        moduleLoadTimes.delete(args.moduleName);
      }
      
      return args;
    }
  };
}
```

### Custom Shared Module Strategy

Control how shared modules are loaded:

```javascript
function createHostPreferencePlugin() {
  return {
    name: 'host-preference-plugin',
    
    beforeLoadShare(args) {
      // For React, always prefer the host's version
      if (args.name === 'react') {
        return {
          ...args,
          options: {
            ...args.options,
            strategy: 'host-first'
          }
        };
      }
      
      // For other libraries, use highest version
      return {
        ...args,
        options: {
          ...args.options,
          strategy: 'highest-version'
        }
      };
    }
  };
}
```

## Advanced Topics

### Plugin Composition

Plugins are executed in the order they are registered. Each hook can modify the arguments passed to the next plugin:

```javascript
// First plugin adds request ID
const plugin1 = {
  name: 'plugin1',
  beforeRequest(args) {
    return {
      ...args,
      requestId: generateRequestId()
    };
  }
};

// Second plugin uses the request ID
const plugin2 = {
  name: 'plugin2',
  beforeRequest(args) {
    console.log(`Processing request ${args.requestId}`);
    return args;
  }
};

// Register in order
registerPlugins([plugin1, plugin2]);
```

### Async Hooks

Hooks can be asynchronous:

```javascript
function createAsyncPlugin() {
  return {
    name: 'async-plugin',
    
    async beforeRequest(args) {
      // Fetch configuration from API
      const config = await fetch('/api/federation-config').then(r => r.json());
      
      // Apply configuration
      return {
        ...args,
        options: {
          ...args.options,
          ...config
        }
      };
    }
  };
}
```

### Plugin State

Plugins can maintain internal state:

```javascript
function createStatefulPlugin() {
  // Private state
  const loadCounts = new Map();
  
  // Return the plugin
  return {
    name: 'stateful-plugin',
    
    beforeRequest(args) {
      const count = loadCounts.get(args.moduleName) || 0;
      loadCounts.set(args.moduleName, count + 1);
      
      console.log(`Loading ${args.moduleName} (attempt ${count + 1})`);
      return args;
    },
    
    // Method to access internal state (not a hook)
    getLoadCount(moduleName) {
      return loadCounts.get(moduleName) || 0;
    }
  };
}
```

## Troubleshooting

### Plugin Not Executing

If your plugin hooks aren't being called:

1. Check plugin registration order (plugins are executed in order)
2. Verify your hook name is correct
3. Ensure the plugin is properly registered

### Debugging Plugins

Add console logging to your plugins:

```javascript
function createDebugPlugin() {
  return {
    name: 'debug-plugin',
    
    beforeInit(options) {
      console.log('[debug] beforeInit:', options);
      return options;
    },
    
    beforeRequest(args) {
      console.log('[debug] beforeRequest:', args);
      return args;
    },
    
    errorLoadRemote(args) {
      console.log('[debug] errorLoadRemote:', args);
      return args;
    }
  };
}

// Register as the first plugin to see all other plugins' changes
registerPlugins([createDebugPlugin(), ...otherPlugins]);
```

### Common Issues

1. **Plugin registered too late**: Register plugins before initialization
2. **Hook returning wrong data**: Ensure you return the modified arguments
3. **Asynchronous hook not working**: Make sure to use `async`/`await` properly
4. **Plugin conflict**: Check for plugins modifying the same properties

## Example: Complete Plugin Configuration

Here's a comprehensive example combining multiple plugins:

```javascript
// webpack.config.js
const { withZephyr } = require('@zephyr/webpack-plugin');
const { 
  createRetryPlugin, 
  createFallbackPlugin,
  createCachePlugin,
  createVersioningPlugin,
  createMonitoringPlugin
} = require('@zephyr/runtime/plugins');

module.exports = withZephyr({
  // ... other webpack config
  plugins: [
    new ModuleFederationPlugin({
      name: 'host',
      remotes: {
        remote1: 'remote1@http://localhost:3001/remoteEntry.js',
        remote2: 'remote2@http://localhost:3002/remoteEntry.js'
      },
      shared: {
        react: { singleton: true, requiredVersion: '^18.0.0' },
        'react-dom': { singleton: true, requiredVersion: '^18.0.0' }
      },
      // Configure runtime plugins
      runtimePlugins: [
        // Retry logic for failed loads
        createRetryPlugin({
          fetch: { 
            retryTimes: 3, 
            retryDelay: 500 
          }
        }),
        
        // Fallbacks for remotes
        createFallbackPlugin({
          remotes: {
            remote1: 'http://backup.example.com/remote1/remoteEntry.js',
            remote2: 'http://backup.example.com/remote2/remoteEntry.js'
          }
        }),
        
        // Cache successful loads
        createCachePlugin({
          cacheDuration: 3600000, // 1 hour
          persistent: true
        }),
        
        // Version overrides for shared modules
        createVersioningPlugin({
          versionOverrides: {
            'react': '^18.2.0',
            'react-dom': '^18.2.0'
          },
          strategy: 'highest'
        }),
        
        // Performance monitoring
        createMonitoringPlugin({
          enableLogs: true,
          enablePerformanceMarks: true
        }),
        
        // Custom plugins
        path.resolve(__dirname, './src/plugins/error-handling-plugin.js'),
        path.resolve(__dirname, './src/plugins/analytics-plugin.js')
      ]
    })
  ]
});
```