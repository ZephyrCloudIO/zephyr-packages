# Zephyr XPack Internal (Internal)

<div align="center">

[Zephyr Cloud](https://zephyr-cloud.io) | [Zephyr Docs](https://docs.zephyr-cloud.io) | [Discord](https://zephyr-cloud.io/discord) | [Twitter](https://x.com/ZephyrCloudIO) | [LinkedIn](https://www.linkedin.com/company/zephyr-cloud/)

<hr/>
<img src="https://cdn.prod.website-files.com/669061ee3adb95b628c3acda/66981c766e352fe1f57191e2_Opengraph-zephyr.png" alt="Zephyr Logo" />
</div>

**Internal Package** - Shared types, Module Federation capabilities, and utilities for bundlers built on top of Webpack or Rspack. This package provides common functionality for Webpack-compatible bundlers.

> **Note**: This is an internal package used by Webpack and Rspack plugins. It is not intended for direct use by end users.

## Overview

The Zephyr XPack Internal package provides shared functionality for Webpack-compatible bundlers:

- **Module Federation**: Advanced Module Federation capabilities and utilities
- **Federation Dashboard**: Build-time analytics and federation insights
- **XPack Extraction**: Asset and configuration extraction for Webpack/Rspack
- **Lifecycle Events**: Build lifecycle hooks and event management
- **Shared Types**: Common TypeScript interfaces and types

## Package Structure

### Federation Dashboard Legacy (`federation-dashboard-legacy/`)

- Legacy Module Federation dashboard functionality
- Build statistics collection and analysis
- Dependency graph conversion and visualization
- Federation metadata processing

### Hooks (`hooks/`)

- Build lifecycle event hooks
- Deployment setup and logging configuration
- Integration points for build processes

### Lifecycle Events (`lifecycle-events/`)

- Standardized build lifecycle management
- Event dispatching and handling
- Plugin coordination during builds

### XPack Extract (`xpack-extract/`)

- Webpack/Rspack asset extraction utilities
- Module Federation configuration extraction
- Runtime code generation for federation
- Federation dependency analysis

## Federation Dashboard

Advanced Module Federation analytics and insights:

### Build Statistics

```typescript
interface FederationBuildStats {
  modules: ModuleInfo[];
  dependencies: DependencyInfo[];
  remotes: RemoteInfo[];
  exposes: ExposeInfo[];
  shared: SharedInfo[];
  buildTime: number;
  bundleSize: number;
}
```

### Dependency Graph Conversion

```typescript
// Convert webpack stats to federation graph
const graph = convertToGraph(webpackStats, {
  includeModules: true,
  includeDependencies: true,
  includeChunks: true,
});
```

### License Extraction

```typescript
// Extract license information from modules
const licenses = getLicenses(modules, {
  includeDevDependencies: false,
  groupByLicense: true,
});
```

## Module Federation Utilities

### Federation Config Extraction

```typescript
// Extract federation configuration from webpack config
const federationConfig = extractFederationConfig(webpackConfig);

// Iterate through remote configurations
const remotes = iterateFederatedRemoteConfig(federationConfig);

// Process federation dependencies
const deps = extractFederatedDependencyPairs(config);
```

### Runtime Code Generation

```typescript
// Create Module Federation runtime code
const runtimeCode = createMfRuntimeCode({
  remotes: federationConfig.remotes,
  shared: federationConfig.shared,
  exposes: federationConfig.exposes,
});
```

### Plugin Detection

```typescript
// Detect Module Federation plugin in webpack config
const isModuleFederation = isModuleFederationPlugin(plugin);

// Extract federation plugin options
const options = makeCopyOfModuleFederationOptions(plugin);
```

## Asset Management

### Webpack Assets Map

```typescript
// Build comprehensive assets map
const assetsMap = buildWebpackAssetsMap(compilation, {
  includeSourceMaps: true,
  includeChunks: true,
  includeModules: true,
});
```

### Asset Upload

```typescript
// Upload agent for assets
const uploadAgent = new ZeXpackUploadAgent({
  assets: assetsMap,
  federation: federationConfig,
  buildStats: stats,
});

await uploadAgent.upload();
```

## Version Strategy

Compute versioning strategy for federated modules:

```typescript
// Compute version strategy for federation
const versionStrategy = computeVersionStrategy({
  packageJson: packageInfo,
  gitInfo: gitContext,
  buildContext: buildInfo,
});
```

## Graph Merging

Merge multiple federation graphs:

```typescript
// Merge federation graphs from multiple builds
const mergedGraph = mergeGraphs([hostGraph, remoteGraph1, remoteGraph2], {
  deduplicateModules: true,
  preserveMetadata: true,
});
```

## Integration with Bundlers

### Webpack Integration

```typescript
// Webpack plugin integration
class ZephyrWebpackPlugin {
  apply(compiler) {
    // Use xpack utilities
    const federationConfig = extractFederationConfig(compiler.options);
    const assetsMap = buildWebpackAssetsMap(compilation);
  }
}
```

### Rspack Integration

```typescript
// Rspack plugin integration
class ZephyrRspackPlugin {
  apply(compiler) {
    // Reuse webpack-compatible utilities
    const federationConfig = extractFederationConfig(compiler.options);
    const stats = convertToGraph(compilation.getStats());
  }
}
```

## Advanced Features

### Federation Dashboard Plugin

```typescript
// Advanced federation analytics
const dashboardPlugin = new FederationDashboardPlugin({
  filename: 'federation-stats.json',
  includeModules: true,
  includeDependencies: true,
  computeVersionStrategy: true,
});
```

### Runtime Requirements

```typescript
// Add runtime requirements for federation
addRuntimeRequirementToPromiseExternal(compilation, 'federation-runtime');
```

## Development Utilities

### Mock Data

- Comprehensive test data for federation scenarios
- Mock configurations for testing plugins
- Sample build statistics and dependency graphs

### Validation

```typescript
// Validate federation parameters
const isValid = validateParams({
  federationConfig,
  webpackConfig,
  buildContext,
});
```

## Usage by Plugins

Webpack and Rspack plugins use this package:

```typescript
import { extractFederationConfig, buildWebpackAssetsMap, convertToGraph, FederationDashboardPlugin } from 'zephyr-xpack-internal';

// In webpack/rspack plugin
const federationConfig = extractFederationConfig(compiler.options);
const assetsMap = buildWebpackAssetsMap(compilation);
const graph = convertToGraph(stats);
```

## Development

For internal development:

```bash
# Build the package
npm run build

# Run tests
npm run test

# Test with mock data
npm run test:integration
```

## Contributing

This is an internal package. Contributions should be made through the main Zephyr plugins repository. Please read our [contributing guidelines](../../CONTRIBUTING.md) for more information.

## License

Licensed under the Apache-2.0 License. See [LICENSE](LICENSE) for more information.
