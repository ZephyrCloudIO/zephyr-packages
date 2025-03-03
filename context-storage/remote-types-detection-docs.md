# Remote Types Detection Documentation

## Overview

The Remote Types Detection functionality provides automatic detection and configuration for Client-Side Rendering (CSR) and Server-Side Rendering (SSR) applications. This is crucial for properly integrating federated modules with different rendering approaches.

## Key Features

1. **Automatic Detection**: Identifies rendering approach from dependencies, configuration, and entry points
2. **Framework Detection**: Recognizes popular frameworks like Next.js, Remix, Gatsby, and others
3. **Configuration Options**: Supports explicit configuration overrides with validation
4. **Manifest Integration**: Enhances manifests with render type and framework information
5. **Confidence-Based Resolution**: Intelligently resolves conflicting detection signals

## Core Components

### RemoteTypeDetector

The `RemoteTypeDetector` is the core utility for detecting render types from various signals.

```typescript
import { RemoteTypeDetector } from './remote-types-detection';

// Detect from dependencies in package.json
const dependencies = {
  'next': '^13.0.0',
  'react': '^18.0.0'
};
const renderType = RemoteTypeDetector.detectFromDependencies(dependencies);  // 'ssr'

// Detect from bundler configuration
const webpackConfig = {
  target: 'node',
  output: {
    libraryTarget: 'commonjs2'
  }
};
const configType = RemoteTypeDetector.detectFromConfiguration(webpackConfig);  // 'ssr'

// Detect from entrypoints
const entrypoints = ['server.js', 'client.js'];
const entryType = RemoteTypeDetector.detectFromEntrypoints(entrypoints);  // 'ssr'
```

### FrameworkDetector

The `FrameworkDetector` identifies JavaScript frameworks from dependencies and provides default render types.

```typescript
import { FrameworkDetector } from './remote-types-detection';

// Detect framework
const dependencies = {
  'next': '^13.0.0',
  'react': '^18.0.0'
};
const framework = FrameworkDetector.detectFramework(dependencies);  // 'nextjs'

// Get default render type for a framework
const defaultRenderType = FrameworkDetector.getFrameworkDefaultRenderType('nextjs');  // 'ssr'
```

### RemoteTypeConfig

The `RemoteTypeConfig` processes configuration options for render types with validation.

```typescript
import { RemoteTypeConfig } from './remote-types-detection';

// Parse explicit configuration
const config = { renderType: 'ssr' };
const renderType = RemoteTypeConfig.parseConfig(config);  // 'ssr'

// Fall back to detected type if not specified
const emptyConfig = {};
const detectedType = 'csr';
const fallbackType = RemoteTypeConfig.parseConfig(emptyConfig, detectedType);  // 'csr'
```

### RemoteTypeManifest

The `RemoteTypeManifest` adds render type information to manifests.

```typescript
import { RemoteTypeManifest } from './remote-types-detection';

// Add render type to manifest
const manifest = {};
const renderType = 'ssr';
const updatedManifest = RemoteTypeManifest.addTypeToManifest(manifest, renderType);
// { renderType: 'ssr' }

// Add confidence level
const confidenceManifest = RemoteTypeManifest.addTypeToManifest(manifest, renderType, 0.8);
// { renderType: 'ssr', detectionConfidence: 0.8 }
```

### RemoteTypeIntegration

The `RemoteTypeIntegration` provides high-level integration with conflict resolution.

```typescript
import { RemoteTypeIntegration } from './remote-types-detection';

// Determine render type from multiple sources
const packageJson = {
  dependencies: {
    'next': '^13.0.0',
    'react': '^18.0.0'
  }
};
const config = {};
const webpackConfig = { target: 'node' };
const entrypoints = ['server.js', 'client.js'];

const renderType = RemoteTypeIntegration.determineRemoteType(
  packageJson, config, webpackConfig, entrypoints
);  // 'ssr'

// Apply render type and framework info to manifest
const manifest = {};
const enhancedManifest = RemoteTypeIntegration.applyRemoteTypeToManifest(manifest, packageJson);
// { renderType: 'ssr', framework: 'nextjs', frameworkVersion: '^13.0.0' }
```

## Bundler Integration

### Vite Integration

```typescript
import { defineConfig } from 'vite';
import { RemoteTypeIntegration } from './remote-types-detection';

export default defineConfig({
  plugins: [
    {
      name: 'vite-remote-type',
      configResolved(config) {
        // Read package.json
        const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
        
        // Determine render type
        const renderType = RemoteTypeIntegration.determineRemoteType(packageJson, {}, config);
        
        // Configure Vite accordingly
        if (renderType === 'ssr') {
          console.log('SSR mode detected, configuring Vite for SSR');
          // Add SSR-specific configuration
        }
      }
    }
  ]
});
```

### Webpack/Rspack Integration

```typescript
const { RemoteTypeIntegration } = require('./remote-types-detection');
const fs = require('fs');

module.exports = {
  // ... webpack config
  plugins: [
    {
      apply(compiler) {
        compiler.hooks.beforeCompile.tapAsync('RemoteTypeDetection', (params, callback) => {
          // Read package.json
          const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
          
          // Determine render type
          const renderType = RemoteTypeIntegration.determineRemoteType(packageJson, {}, compiler.options);
          
          // Configure accordingly
          if (renderType === 'ssr') {
            console.log('SSR mode detected, configuring Webpack for SSR');
            // Modify compiler options for SSR
          }
          
          callback();
        });
      }
    }
  ]
};
```

## Best Practices

1. **Provide Explicit Configuration** when automatic detection might be ambiguous
2. **Check Detection Confidence** when integrating with critical systems
3. **Use Framework Detection** to provide framework-specific optimizations
4. **Combine Multiple Detection Methods** for higher accuracy
5. **Test with Various Frameworks** to ensure reliable detection

## Edge Cases and Considerations

1. **Mixed CSR/SSR Applications**: Applications with both client and server components might need explicit configuration
2. **Custom Frameworks**: May require manual configuration if not recognized
3. **Non-Standard Entry Points**: Custom entry point naming could affect detection accuracy
4. **Advanced Bundler Configurations**: Highly customized configurations might interfere with detection
5. **Framework Versions**: Different versions of frameworks may have different rendering approaches

## Performance Considerations

1. **Detection is performed once at build time**, not at runtime
2. **Caching of framework detection** results for improved performance
3. **Minimal overhead** for configuration validation

## Conclusion

The Remote Types Detection functionality provides a robust solution for automatically detecting and configuring applications based on their rendering approach. It supports a wide range of frameworks and bundlers, with fallback to explicit configuration when needed. This ensures proper integration of federated modules across different rendering environments.