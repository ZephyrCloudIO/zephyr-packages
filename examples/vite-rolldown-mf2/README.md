# Vite 6.0 + Rolldown with Module Federation 2.0 Example

This example demonstrates Zephyr integration with Vite 6.0, Rolldown, and Module Federation 2.0.

## Structure

- `/host` - Host application (consumer)
- `/remote` - Remote application (provider)
- `/shared` - Shared libraries

## Key Features

- Uses Vite 6.0 with Rolldown bundler
- Integrates Module Federation 2.0 via `@module-federation/vite` plugin
- Integrated with Zephyr via `zephyr-vite-plugin`
- Demonstrates remote component loading with React
- Supports TypeScript

## Running the Example

### Install Dependencies

```bash
cd host && pnpm install
cd ../remote && pnpm install
```

### Build and Run

#### Remote Application

```bash
cd remote
pnpm build
pnpm serve
```

This will build and start the remote server on http://localhost:4002

#### Host Application

```bash
cd host
pnpm build
pnpm serve
```

This will build and start the host server on http://localhost:4001

## Integration with Zephyr

This example uses Zephyr to handle proper versioning and distribution of federated modules. Key integration points:

1. The `withZephyr` wrapper around federation in the Vite configuration:

```js
withZephyr(federation({
  // MF configuration
}))
```

2. Automatic handling of Module Federation 2.0 features including:
   - ESM-compatible module loading
   - Enhanced shared module resolution
   - Proper handling of scope overrides

## Rolldown Integration

This example specifically uses Rolldown as the bundler for Vite 6.0. Rolldown offers:

- Faster builds than Rollup
- Full ESM compatibility
- Improved code-splitting
- Better tree-shaking

## Testing

This example is included in the Zephyr testing matrix and is automatically tested for compatibility with each new version.