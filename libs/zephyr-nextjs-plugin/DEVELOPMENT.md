# Zephyr Next.js Plugin - Development Documentation

## Overview

The `zephyr-nextjs-plugin` is a specialized webpack plugin designed to integrate Next.js applications with Zephyr Cloud deployment platform. This plugin was created to address the unique challenges of deploying Next.js applications with their three-phase build system (client, server, and edge) to Zephyr's edge infrastructure.

## Problem Statement

Next.js creates three separate webpack configurations during each build:

1. **Server Build** (`isServer: true, nextRuntime: 'nodejs'`) - Server-side rendering code for Node.js runtime
2. **Edge Server Build** (`isServer: true, nextRuntime: 'edge'`) - Code for Edge Runtime environment  
3. **Client Build** (`isServer: false, nextRuntime: undefined`) - Browser-side JavaScript bundles

The existing `zephyr-webpack-plugin` was incompatible with Next.js due to:
- **Async/Sync Mismatch**: Next.js expects synchronous webpack functions, but Zephyr uses async operations
- **Entry Structure Corruption**: The plugin was corrupting Next.js's critical `main-app` entry required for App Router
- **Hook Timing Issues**: Using incorrect webpack hooks that don't fire in Next.js's compilation process

## Architecture

### Plugin Structure

```
zephyr-nextjs-plugin/
├── src/
│   ├── index.ts                    # Main exports
│   ├── types/
│   │   ├── index.ts               # Plugin options interface
│   │   └── missing-webpack-types.ts
│   └── nextjs-plugin/
│       ├── with-zephyr.ts         # Main configuration function
│       └── ze-nextjs-plugin.ts    # Webpack plugin implementation
├── package.json
├── README.md
└── DEVELOPMENT.md
```

### Key Components

#### 1. `withZephyr()` Function
- **Synchronous** configuration function that Next.js calls
- Safely extracts Next.js build context (`isServer`, `nextRuntime`, `buildId`)
- Adds the Zephyr webpack plugin without breaking Next.js internals

#### 2. `ZeNextJSPlugin` Class
- Handles **async initialization** of ZephyrEngine in webpack hooks
- Manages **deployment hooks** using Next.js-compatible patterns
- Supports **build context filtering** for selective deployment

#### 3. **Async Initialization Pattern**
```typescript
// Synchronous webpack config modification
webpack: (config, context) => {
  return withZephyr()(config, context); // Returns immediately
}

// Asynchronous initialization in webpack hooks
compiler.hooks.beforeRun.tapAsync(pluginName, async (compiler, callback) => {
  await this.initializeZephyr(); // Initialize async operations
  callback();
});
```

## Technical Challenges Solved

### 1. **Async/Sync Compatibility**

**Problem**: Next.js calls webpack functions synchronously, but ZephyrEngine.create() is async.

**Solution**: 
- Make `withZephyr()` synchronous, returning config immediately
- Move async operations to webpack hooks (`beforeRun`, `watchRun`)
- Initialize ZephyrEngine when webpack compilation starts

```typescript
// ❌ Old approach (breaks Next.js)
export function withZephyr() {
  return async (config) => {
    const engine = await ZephyrEngine.create(); // Async!
    return config;
  };
}

// ✅ New approach (Next.js compatible)
export function withZephyr() {
  return (config, context) => {
    config.plugins.push(new ZeNextJSPlugin({ /* async init later */ }));
    return config; // Synchronous return
  };
}
```

### 2. **Webpack Hook Compatibility**

**Problem**: Original plugin used `thisCompilation` + `PROCESS_ASSETS_STAGE_REPORT` hooks that don't fire in Next.js.

**Solution**: Use the same hook pattern as Next.js core plugins:

```typescript
// ❌ Old approach (doesn't fire in Next.js)
compiler.hooks.thisCompilation.tap(pluginName, (compilation) => {
  compilation.hooks.processAssets.tapPromise({
    stage: PROCESS_ASSETS_STAGE_REPORT
  }, async (assets) => { /* deploy */ });
});

// ✅ New approach (matches Next.js patterns)
compiler.hooks.make.tap(pluginName, (compilation) => {
  compilation.hooks.processAssets.tapPromise({
    stage: PROCESS_ASSETS_STAGE_ADDITIONS
  }, async (assets) => { /* deploy */ });
});
```

### 3. **Entry Structure Preservation**

**Problem**: Next.js App Router requires specific entry structure that was being corrupted.

**Solution**: 
- Don't modify webpack entries in the main configuration function
- Use webpack hooks for all async operations
- Preserve Next.js's critical `main-app` entry structure

## Build Flow

### 1. **Configuration Phase** (Synchronous)
```
Next.js calls webpack function
  ↓
withZephyr() extracts build context
  ↓
Adds ZeNextJSPlugin to config.plugins
  ↓
Returns config immediately (sync)
```

### 2. **Initialization Phase** (Async in hooks)
```
webpack starts compilation
  ↓
beforeRun/watchRun hooks fire
  ↓
ZephyrEngine.create() initializes
  ↓
Module federation configs processed
  ↓
Deployment hooks configured
```

### 3. **Asset Processing Phase**
```
webpack processes assets
  ↓
make hook fires
  ↓
processAssets hook fires (STAGE_ADDITIONS)
  ↓
Assets extracted and uploaded to Zephyr
  ↓
Deployment URLs generated
```

## Configuration Options

```typescript
interface ZephyrNextJSPluginOptions {
  // Optional flag to wait for index.html processing
  wait_for_index_html?: boolean;
  
  // NextJS specific options
  deployOnClientOnly?: boolean; // If true, only deploy on client build
  preserveServerAssets?: boolean; // If true, preserve server build assets
}
```

## Usage Examples

### Basic Usage
```javascript
// next.config.js
const { withZephyr } = require('zephyr-nextjs-plugin');

const nextConfig = {
  webpack: (config, context) => {
    return withZephyr()(config, context);
  },
};

module.exports = nextConfig;
```

### Advanced Configuration
```javascript
// next.config.js
const { withZephyr } = require('zephyr-nextjs-plugin');

const nextConfig = {
  webpack: (config, context) => {
    return withZephyr({
      deployOnClientOnly: false,    // Deploy all build types
      wait_for_index_html: true,    // Don't wait for index.html
    })(config, context);
  },
  output: 'standalone', // For containerized deployments
};

module.exports = nextConfig;
```

### TypeScript Configuration
```typescript
// next.config.ts
import { withZephyr } from 'zephyr-nextjs-plugin';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  webpack: (config, context) => {
    return withZephyr()(config, context);
  },
};

export default nextConfig;
```

## Deployment Results

When successful, the plugin deploys all three Next.js build outputs:

```bash
✅ Zephyr engine initialized for Next.js
🔧 Zephyr deployment hooks configured for Next.js

# Server Build (#1938)
ZEPHYR   Uploaded local snapshot in 183ms
ZEPHYR   (8/8 assets uploaded in 258ms, 956.91kb)
ZEPHYR   https://nestor-lopez-1938-nextjs-15-zephyr-packages-zephy-75851b8a2-ze.zephyrcloud.app

# Edge Build (#1939)  
ZEPHYR   No assets to upload, skipping...
ZEPHYR   https://nestor-lopez-1939-nextjs-15-zephyr-packages-zephy-4e34d42d1-ze.zephyrcloud.app

# Client Build (#1940)
ZEPHYR   Uploaded local snapshot in 107ms
ZEPHYR   (17/21 assets uploaded in 272ms, 1640.99kb)
ZEPHYR   https://nestor-lopez-1940-nextjs-15-zephyr-packages-zephy-95cb112b9-ze.zephyrcloud.app
```

## Testing

```bash
# Build the plugin
pnpm build

# Test with Next.js example
cd examples/nextjs-15
pnpm build

# Test with debug logging
DEBUG=zephyr* pnpm build
```

## Future Enhancements

1. **Build Type Filtering**: More granular control over which builds to deploy
2. **Asset Optimization**: Next.js-specific asset optimization strategies
3. **Module Federation**: Enhanced support for Next.js micro-frontends
4. **Edge Runtime**: Specialized handling for Edge Runtime deployments
5. **Build Caching**: Integration with Next.js build cache for faster deployments

## Contributing

This plugin follows the same patterns as other Zephyr plugins:

1. **API Consistency**: Same `withZephyr()` interface
2. **Build Integration**: Same build and publish process
3. **Testing Standards**: Same testing patterns and coverage requirements
4. **Documentation**: Same documentation structure and examples

## Compatibility

- **Next.js**: 13+ (App Router and Pages Router)
- **Node.js**: 18+
- **Webpack**: 5+ (via Next.js)
- **TypeScript**: Full support

## License

Apache-2.0 License - Same as all Zephyr packages