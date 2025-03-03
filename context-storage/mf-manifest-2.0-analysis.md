# Module Federation 2.0 Manifest Format Analysis

## Overview

This document analyzes the Module Federation 2.0 manifest format based on research of the tmp-rolldown/mf-core repository, focusing on the core structure, functionality, and differences from Module Federation 1.0 that will need to be addressed in the Zephyr implementation.

## MF 2.0 Manifest Structure

The manifest file, typically named `mf-manifest.json`, has the following core structure:

```typescript
export interface Manifest<
  T = BasicStatsMetaData,
  K = ManifestRemoteCommonInfo,
> {
  id: string;
  name: string;
  metaData: StatsMetaData<T>;
  shared: ManifestShared[];
  remotes: ManifestRemote<K>[];
  exposes: ManifestExpose[];
}
```

### Key Components

1. **MetaData (StatsMetaData)**
   - Contains core information about the federated module:
     - `name`: The name of the module
     - `globalName`: The global variable name for the module
     - `buildInfo`: Version information
     - `remoteEntry`: Information about the remote entry file (name, path, type)
     - `types`: TypeScript type information
     - `publicPath` or `getPublicPath`: The path to access assets

2. **Shared Modules (ManifestShared[])**
   - Lists shared dependencies with:
     - `id`: Unique identifier for the shared module
     - `name`: Name of the shared module
     - `version`: Version of the shared module
     - `singleton`: Whether only one instance should be used
     - `requiredVersion`: Version constraint for resolution
     - `assets`: JS and CSS assets needed by the shared module
       - Divided into sync and async chunks

3. **Remote Modules (ManifestRemote[])**
   - Information about remote modules being consumed:
     - `federationContainerName`: Name of the container
     - `moduleName`: Name of the module to import
     - `alias`: Reference name for the remote
     - `entry`: URL to the remote entry file

4. **Exposed Modules (ManifestExpose[])**
   - Modules exposed by the container:
     - `id`: Unique identifier for the exposed module
     - `name`: Name of the exposed module
     - `path`: Path to the module
     - `assets`: JS and CSS assets required by the module
       - Divided into sync and async chunks

## MF 2.0 Runtime Plugins

Module Federation 2.0 introduces a flexible plugin system for extending federation functionality at runtime:

### Structure

```typescript
interface FederationRuntimePlugin {
  name: string; // Unique plugin name
  // Lifecycle hooks
  beforeInit?(args: any): any;
  beforeRequest?(args: any): any;
  afterResolve?(args: any): any;
  onLoad?(args: any): any;
  errorLoadRemote?(args: any): any;
  beforeLoadShare?(args: any): any;
  createScript?(args: any): any;
  // ... other hooks
}
```

### Registration Methods

1. **Build-time registration**
   ```typescript
   new ModuleFederation({
     name: 'host',
     remotes: { ... },
     runtimePlugins: [path.resolve(__dirname, './custom-runtime-plugin.ts')],
   })
   ```

2. **Runtime registration**
   ```typescript
   import { registerGlobalPlugins } from '@module-federation/enhanced/runtime';
   registerGlobalPlugins([customPlugin()]);
   ```

### Common Plugin Types

1. **Error handling plugins**: Provide fallback mechanisms when module loading fails
2. **Shared module strategy plugins**: Control how shared modules are loaded and resolved
3. **Retry plugins**: Implement retry logic with backoff for failed resource loading
4. **Preload plugins**: Manage asset preloading for performance optimization

## Differences from MF 1.0 and Current Zephyr Implementation

1. **Manifest Format**:
   - MF 1.0: No standardized manifest format
   - MF 2.0: Structured manifest with detailed metadata and asset information
   - Zephyr: Simpler manifest in `Snapshot` interface with basic MF configuration

2. **Remote Resolution**:
   - MF 1.0: Static configuration with limited runtime flexibility
   - MF 2.0: Enhanced container interface with promise-based loading
   - Zephyr: Custom resolution through `resolve_remote_dependency` and `createMfRuntimeCode`

3. **Plugin System**:
   - MF 1.0: No standardized plugin system
   - MF 2.0: Comprehensive lifecycle hooks for runtime customization
   - Zephyr: No current support for runtime plugins

4. **Asset Management**:
   - MF 1.0: Basic asset management
   - MF 2.0: Detailed asset tracking with sync/async classification
   - Zephyr: Asset tracking through `SnapshotAsset` but without MF 2.0's granularity

5. **Type Definitions**:
   - MF 1.0: Limited type support
   - MF 2.0: Enhanced type definitions with manifest support
   - Zephyr: Basic type interfaces for MF configuration

## Key Integration Points for Zephyr Enhancement

1. **Plugin Detection**:
   - Update `isModuleFederationPlugin` to recognize MF 2.0 plugins from @module-federation/enhanced
   - Need to handle different plugin names and structures

2. **Manifest Handling**:
   - Create adapters between MF 2.0 manifest and Zephyr format
   - Extend Zephyr's `Snapshot` interface to include MF 2.0 specific fields
   - Implement versioning for backward compatibility

3. **Runtime Code Generation**:
   - Update `createMfRuntimeCode` to support MF 2.0's container protocol
   - Enhance `xpack_delegate_module_template` to work with MF 2.0 initialization flow
   - Add support for runtime plugins

4. **Asset Processing**:
   - Enhance asset extraction to capture sync/async chunk information
   - Update assets map structure to align with MF 2.0 format

5. **Type Definitions**:
   - Extend `XFederatedRemotesConfig` to include MF 2.0 specific options
   - Add new interfaces for runtime plugins and container interaction