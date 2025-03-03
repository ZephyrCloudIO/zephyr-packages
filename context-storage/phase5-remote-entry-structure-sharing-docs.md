# Remote Entry Structure Sharing - Documentation

## Overview

The Remote Entry Structure Sharing component enables federated modules to share metadata about their structure, frameworks, dependencies, and compatibility requirements. This enhances integration between remotes and hosts, providing better error handling, compatibility checking, and optimization opportunities.

## Key Components

### 1. MetadataSchema

Defines and validates the structure of remote entry metadata:

- **Required fields**: `schemaVersion`, `moduleFederationVersion`, `renderType`, `framework`
- **Optional fields**: `frameworkVersion`, `dependencies`, `exports`
- **Validation**: Ensures all metadata follows the required structure and valid values

```typescript
// Example metadata
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
      import: './src/components/Button',
      types: './src/components/Button.d.ts'
    }
  }
};
```

### 2. MetadataExtractor

Extracts metadata from package.json and bundler configurations:

- **Framework detection**: Identifies frameworks (Next.js, React, Vue, etc.) and their rendering type (CSR/SSR)
- **Module Federation detection**: Detects MF version from dependencies and plugins
- **Export extraction**: Extracts exposed modules and their types

```typescript
// Extract from package.json
const metadata = MetadataExtractor.extractFromPackage(packageJson);

// Extract from webpack config
const bundlerMetadata = MetadataExtractor.extractFromBundlerConfig(webpackConfig);
```

### 3. MetadataPublisher

Publishes metadata alongside remoteEntry files:

- **Generates**: Creates `remoteEntry.metadata.json` alongside `remoteEntry.js`
- **URL mapping**: Supports mapping remoteEntry URLs to their metadata counterparts

```typescript
// Publish metadata
const metadataPath = MetadataPublisher.publishMetadata(
  metadata,
  '/dist',
  'remoteEntry.js'
);

// Get metadata URL
const metadataUrl = MetadataPublisher.getMetadataUrl('https://example.com/remoteEntry.js');
// Returns: https://example.com/remoteEntry.metadata.json
```

### 4. MetadataConsumer

Consumes and validates remote metadata:

- **Fetching**: Retrieves metadata from remote URLs with caching
- **Validation**: Checks compatibility between host and remote metadata
- **Issue detection**: Identifies conflicts in renderType, framework, and dependencies

```typescript
// Fetch remote metadata
const remoteMetadata = await MetadataConsumer.fetchMetadata('https://example.com/remoteEntry.js');

// Validate compatibility
const result = MetadataConsumer.validateCompatibility(hostMetadata, remoteMetadata);

if (result.compatible) {
  console.log('Remote is compatible with host');
} else {
  console.error('Incompatibilities detected:', result.issues);
}

if (result.warnings.length > 0) {
  console.warn('Compatibility warnings:', result.warnings);
}
```

### 5. RemoteStructureSharingIntegration

Integrates with bundler plugins:

- **Publisher setup**: Adds metadata publishing to bundler config
- **Consumer setup**: Adds metadata consumption and validation
- **Compatibility validation**: Validates all remotes against the host

```typescript
// Setup publisher plugin (for remote applications)
const enhancedConfig = RemoteStructureSharingIntegration.setupBundlerPlugin(
  webpackConfig,
  packageJson
);

// Setup consumer plugin (for host applications)
const enhancedHostConfig = RemoteStructureSharingIntegration.setupConsumerPlugin(
  webpackConfig
);

// Validate remote compatibility
const compatibilityResults = await RemoteStructureSharingIntegration.validateRemoteCompatibility(
  hostMetadata,
  remotes
);
```

## Integration

### Webpack/Rspack Integration

```typescript
// webpack.config.js
const { RemoteStructureSharingIntegration } = require('@zephyr/remote-metadata');
const packageJson = require('./package.json');

// For remote applications
module.exports = RemoteStructureSharingIntegration.setupBundlerPlugin(
  {
    // webpack config
    plugins: [
      new ModuleFederationPlugin({
        name: 'remote',
        filename: 'remoteEntry.js',
        exposes: {
          './Button': './src/components/Button'
        }
      })
    ]
  },
  packageJson
);

// For host applications
module.exports = RemoteStructureSharingIntegration.setupConsumerPlugin(
  {
    // webpack config
    plugins: [
      new ModuleFederationPlugin({
        name: 'host',
        remotes: {
          remote1: 'remote1@https://example.com/remote1/remoteEntry.js'
        }
      })
    ]
  }
);
```

### Vite Integration

```typescript
// vite.config.js
import { RemoteStructureSharingIntegration } from '@zephyr/remote-metadata';
import packageJson from './package.json';
import federation from '@module-federation/vite';

export default RemoteStructureSharingIntegration.setupBundlerPlugin(
  {
    plugins: [
      federation({
        name: 'remote',
        filename: 'remoteEntry.js',
        exposes: {
          './Button': './src/components/Button'
        }
      })
    ],
    build: {
      outDir: 'dist'
    }
  },
  packageJson
);
```

## Compatibility Rules

The compatibility validation follows these rules:

1. **RenderType**:
   - CSR host cannot consume SSR remotes (incompatible)
   - SSR host can consume CSR remotes (warning only)
   - Universal rendering is compatible with both CSR and SSR

2. **Framework**:
   - Different frameworks generate warnings but are not considered incompatible
   - "unknown" framework is compatible with any framework

3. **Dependencies**:
   - Different versions of the same dependency generate warnings
   - Major version differences in React or other core libraries may cause runtime issues

## Benefits

1. **Improved Error Messages**: Developers receive clear error messages about incompatible remotes before runtime errors occur
2. **Framework-Specific Optimizations**: Host can optimize loading based on remote's framework
3. **Automatic SSR/CSR Handling**: Different rendering strategies can be applied based on the remote's type
4. **Type Information**: Enhanced type information for TypeScript integration
5. **Export Discovery**: Host applications can discover available exports from remotes

## Limitations and Considerations

1. **Network Overhead**: Additional HTTP request to fetch metadata (mitigated with caching)
2. **False Positives/Negatives**: Automatic detection may not be 100% accurate (can be overridden manually)
3. **Framework Support**: Some frameworks may require special handling or additional configuration
4. **Build Integration**: Requires integration with build process to generate and publish metadata

## Future Enhancements

1. **Schema Evolution**: Support for evolution of the metadata schema over time
2. **Dynamic Compatibility Resolution**: Runtime adaptation based on compatibility results
3. **Asset Optimization**: Using metadata to optimize asset loading and caching
4. **Enhanced Type Generation**: Improved TypeScript integration with type information
5. **Bundle Size Optimization**: Include only necessary polyfills based on compatibility information