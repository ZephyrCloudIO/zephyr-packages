# Zephyr Edge Contract (Internal)

<div align="center">

[Zephyr Cloud](https://zephyr-cloud.io) | [Zephyr Docs](https://docs.zephyr-cloud.io) | [Discord](https://zephyr-cloud.io/discord) | [Twitter](https://x.com/ZephyrCloudIO) | [LinkedIn](https://www.linkedin.com/company/zephyr-cloud/)

<hr/>
<img src="https://cdn.prod.website-files.com/669061ee3adb95b628c3acda/66981c766e352fe1f57191e2_Opengraph-zephyr.png" alt="Zephyr Logo" />
</div>

**Internal Package** - A collection of API types, contracts, and reusable functions for Zephyr build plugins. This package defines the standardized interfaces and utilities used across the Zephyr ecosystem.

> **Note**: This is an internal package used by other Zephyr plugins. It is not intended for direct use by end users.

## Overview

The Zephyr Edge Contract package provides:

- **Type Definitions**: TypeScript interfaces and types for API communication
- **Contracts**: Standardized contracts for plugin interactions
- **Utilities**: Reusable utility functions for common operations
- **Constants**: Shared constants and configuration values
- **Validation**: Schema validation and type checking utilities

## Package Structure

### API Contract Negotiation (`lib/api-contract-negotiation/`)

- Defines API versioning and compatibility contracts
- Handles contract negotiation between plugins and services
- Ensures backward compatibility across versions

### Edge API (`lib/edge-api/`)

- Type definitions for edge API communication
- Request/response schemas for deployment operations
- Environment and publishing request interfaces

### Plugin Options (`lib/plugin-options/`)

- Standardized plugin configuration interfaces
- Common options shared across Webpack/Rspack plugins
- Type-safe configuration validation

### Promise Utilities (`lib/promise/`)

- Promise-based utility functions and helpers
- Deferred promise implementations
- Lazy loading and tuple promise utilities
- Concurrency control with `forEachLimit`

### String Utilities (`lib/string/`)

- String manipulation and formatting utilities
- ANSI color code stripping functions
- String parsing and validation helpers

### General Utilities (`lib/utils/`)

- Application UID generation
- Snapshot ID creation
- Safe JSON parsing utilities
- Common helper functions

### Zephyr API (`lib/ze-api/`)

- API interfaces for Zephyr Cloud services
- Application listing and version management
- Dependency graph and package.json handling

## Type Definitions

### Build Stats Contract

```typescript
interface ZephyrBuildStats {
  bundler: string;
  buildTime: number;
  assets: AssetInfo[];
  chunks: ChunkInfo[];
  modules: ModuleInfo[];
  dependencies: DependencyInfo[];
}
```

### Edge Contract

```typescript
interface ZephyrEdgeContract {
  version: string;
  capabilities: string[];
  endpoints: EdgeEndpoints;
  authentication: AuthConfig;
}
```

### Plugin Configuration

```typescript
interface ZephyrPluginOptions {
  deploy?: boolean;
  environment?: string;
  metadata?: Record<string, any>;
  buildContext?: BuildContext;
}
```

## Utility Functions

### Promise Utilities

```typescript
// Deferred promise implementation
const deferred = createDeferred<T>();

// Lazy promise loading
const lazyPromise = createLazyPromise(() => expensiveOperation());

// Controlled concurrency
await forEachLimit(items, 3, async (item) => processItem(item));
```

### String Utilities

```typescript
// Strip ANSI color codes
const cleanText = stripAnsi(coloredText);

// String validation and parsing
const isValid = validateString(input, schema);
```

### ID Generation

```typescript
// Generate application UID
const appUid = createApplicationUid(packageName, version);

// Create snapshot ID
const snapshotId = createSnapshotId(buildInfo);
```

## Schema Validation

The package includes JSON schema definitions for:

- **Dependency Schemas**: Validation for Zephyr dependencies
- **Build Context**: Build-time context validation
- **API Requests**: Request/response validation
- **Plugin Options**: Configuration schema validation

## Constants and Enums

```typescript
// API versions
export const API_VERSIONS = {
  V1: 'v1',
  V2: 'v2',
  CURRENT: 'v2',
} as const;

// Build environments
export const ENVIRONMENTS = {
  DEVELOPMENT: 'development',
  STAGING: 'staging',
  PRODUCTION: 'production',
} as const;

// Plugin types
export const PLUGIN_TYPES = {
  WEBPACK: 'webpack',
  RSPACK: 'rspack',
  VITE: 'vite',
  ROLLUP: 'rollup',
} as const;
```

## Error Handling

Standardized error types and handling:

```typescript
interface ZephyrError {
  code: string;
  message: string;
  details?: Record<string, any>;
  stack?: string;
}

// Error creation utilities
const error = createZephyrError('INVALID_CONFIG', 'Configuration is invalid');
```

## Usage by Plugins

Internal packages use this contract for consistency:

```typescript
import { ZephyrPluginOptions, createApplicationUid, stripAnsi, forEachLimit } from 'zephyr-edge-contract';

// Type-safe plugin configuration
function createPlugin(options: ZephyrPluginOptions) {
  // Implementation
}

// Utility usage
const appId = createApplicationUid('my-app', '1.0.0');
const cleanOutput = stripAnsi(buildOutput);
```

## Development

For internal development and testing:

```bash
# Build the package
npm run build

# Run tests
npm run test

# Type checking
npm run type-check
```

## API Compatibility

The package maintains strict API compatibility through:

- **Semantic Versioning**: Breaking changes only in major versions
- **Contract Negotiation**: Runtime compatibility checking
- **Schema Evolution**: Backward-compatible schema updates
- **Type Safety**: Compile-time type checking

## Contributing

This is an internal package. Contributions should be made through the main Zephyr plugins repository. Please read our [contributing guidelines](../../CONTRIBUTING.md) for more information.

## License

Licensed under the Apache-2.0 License. See [LICENSE](LICENSE) for more information.
