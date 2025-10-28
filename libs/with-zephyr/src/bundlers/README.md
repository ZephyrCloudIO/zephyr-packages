# Bundler Configurations

This directory contains individual configuration files for each supported bundler. Each bundler config defines how the codemod detects and transforms configuration files for that specific bundler.

## Structure

```
bundlers/
├── index.ts           # Main registry that exports BUNDLER_CONFIGS
├── webpack.ts         # Webpack bundler configuration
├── rspack.ts          # Rspack bundler configuration
├── vite.ts            # Vite bundler configuration
├── rollup.ts          # Rollup bundler configuration
├── rolldown.ts        # Rolldown bundler configuration
├── rsbuild.ts         # RSBuild bundler configuration
├── rslib.ts           # RSLib bundler configuration
├── modernjs.ts        # Modern.js bundler configuration
├── rspress.ts         # RSPress bundler configuration
├── parcel.ts          # Parcel bundler configuration
└── repack.ts          # React Native Re.Pack configuration
```

## Configuration Schema

Each bundler configuration file exports a `BundlerConfig` object with the following structure:

```typescript
export const {bundler}Config: BundlerConfig = {
  // Array of config file names to search for
  files: string[],

  // NPM package name to install
  plugin: string,

  // Function name to import (null for JSON configs like Parcel)
  importName: string | null,

  // Ordered array of patterns to try (first match wins)
  patterns: [
    {
      // Descriptive name for this pattern
      type: string,

      // Regex to detect this pattern in the config file
      matcher: RegExp,

      // Name of the transformer function to apply
      transform: string
    }
  ]
};
```

## Pattern Matching Strategy

Patterns are evaluated in order, and the **first matching pattern** is used. This allows you to:

1. Check for "already wrapped" patterns first (skip transformation)
2. Match most specific patterns before generic ones
3. Provide fallback patterns at the end

### Example: RSPack Config

```typescript
export const rspackConfig: BundlerConfig = {
  files: ['rspack.config.js', 'rspack.config.ts', 'rspack.config.mjs'],
  plugin: 'zephyr-rspack-plugin',
  importName: 'withZephyr',
  patterns: [
    // 1. Skip if already wrapped
    {
      type: 'export-wrapped-call',
      matcher: /export\s+default\s+withZephyr\s*\(\s*\)\s*\(/,
      transform: 'skipAlreadyWrapped',
    },
    // 2. Check for composePlugins (Nx style)
    {
      type: 'compose-plugins',
      matcher: /composePlugins\s*\(/,
      transform: 'addToComposePlugins',
    },
    // 3. Check for export default object
    {
      type: 'export-default-object',
      matcher: /export\s+default\s+\{/,
      transform: 'wrapExportDefault',
    },
    // 4. Check for plugins array
    {
      type: 'plugins-array',
      matcher: /plugins\s*:\s*\[/,
      transform: 'addToPluginsArray',
    },
    // 5. Fallback to module.exports
    {
      type: 'module-exports',
      matcher: /module\.exports\s*=/,
      transform: 'wrapModuleExports',
    },
  ],
};
```

## Available Transformers

The following transformer functions are available (defined in `src/transformers.ts`):

### Plugin Array Transformers

- `addToPluginsArray` - Adds to existing `plugins: []` array
- `addToPluginsArrayOrCreate` - Creates or adds to `plugins: []` in `defineConfig({})`

### Wrapper Transformers

- `wrapExportDefault` - Wraps `export default {}` with `withZephyr()({})`
- `wrapModuleExports` - Wraps `module.exports =` with `withZephyr()`
- `wrapExportedFunction` - Wraps exported function reference

### Specialized Transformers

- `addToComposePlugins` - Adds to Nx-style `composePlugins()` call
- `addToVitePlugins` - Adds to Vite config plugins
- `addToVitePluginsInFunction` - Adds to Vite config with arrow function
- `addToRollupFunction` - Adds to Rollup function-style config
- `addToRollupArrayConfig` - Adds to Rollup array-style config
- `addToParcelReporters` - Adds to Parcel JSON config

### Utility Transformers

- `skipAlreadyWrapped` - No-op transformer for already configured files

## Adding a New Bundler

To add support for a new bundler:

### 1. Create Config File

Create `src/bundlers/{bundler}.ts`:

```typescript
import type { BundlerConfig } from '../types.js';

export const {bundler}Config: BundlerConfig = {
  files: ['{bundler}.config.js', '{bundler}.config.ts'],
  plugin: 'zephyr-{bundler}-plugin',
  importName: 'withZephyr',
  patterns: [
    {
      type: 'define-config',
      matcher: /defineConfig\s*\(\s*\{/,
      transform: 'addToPluginsArrayOrCreate',
    },
    {
      type: 'plugins-array',
      matcher: /plugins\s*:\s*\[/,
      transform: 'addToPluginsArray',
    },
  ],
};
```

### 2. Register in Index

Add to `src/bundlers/index.ts`:

```typescript
import { {bundler}Config } from './{bundler}.js';

export const BUNDLER_CONFIGS: BundlerConfigs = {
  // ... existing configs
  {bundler}: {bundler}Config,
};

export { {bundler}Config };
```

### 3. Add Transformer (if needed)

If you need a custom transformer, add it to `src/transformers.ts`:

```typescript
export function custom{Bundler}Transform(ast: BabelNode): void {
  traverse(ast, {
    // ... visitor logic
  });
}
```

And register it in `src/index.ts`:

```typescript
const TRANSFORMERS: TransformFunctions = {
  // ... existing transformers
  custom{Bundler}Transform,
};
```

### 4. Add Tests

Add tests in `src/tests/`:

- Unit tests in `transformers.test.ts`
- Integration tests in `codemod.test.ts`
- Config validation in `bundler-configs.test.ts`

## Common Patterns

### defineConfig with Plugins Array

Used by: RSPress, Rolldown, Modern.js

```typescript
patterns: [
  {
    type: 'define-config',
    matcher: /defineConfig\s*\(\s*\{/,
    transform: 'addToPluginsArrayOrCreate', // Creates plugins array if needed
  },
  {
    type: 'plugins-array',
    matcher: /plugins\s*:\s*\[/,
    transform: 'addToPluginsArray', // Adds to existing array
  },
];
```

### Wrapper Pattern

Used by: RSPack (export default object)

```typescript
patterns: [
  {
    type: 'export-default-object',
    matcher: /export\s+default\s+\{/,
    transform: 'wrapExportDefault', // Wraps entire export
  },
];
```

### Compose Pattern

Used by: Webpack, RSPack (Nx style)

```typescript
patterns: [
  {
    type: 'compose-plugins',
    matcher: /composePlugins\s*\(/,
    transform: 'addToComposePlugins', // Adds to plugin composition
  },
];
```

## Design Principles

1. **Consistency**: All bundler configs follow the same schema
2. **Modularity**: Each bundler is isolated in its own file
3. **Extensibility**: Easy to add new bundlers without modifying existing ones
4. **Pattern Priority**: More specific patterns come before generic ones
5. **Fail-Safe**: Each config has a fallback pattern
6. **Self-Documenting**: Comments explain each pattern's purpose

## Testing

Each bundler configuration should be tested with:

- ✅ Detection of config files
- ✅ Pattern matching accuracy
- ✅ Transformation correctness
- ✅ Idempotency (running twice should be safe)
- ✅ Edge cases (already wrapped, no plugins array, etc.)

Run tests with:

```bash
pnpm test
```
