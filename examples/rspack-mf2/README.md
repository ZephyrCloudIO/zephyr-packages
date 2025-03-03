# Rspack with Module Federation 2.0 Example

This example demonstrates Zephyr integration with Rspack and Module Federation 2.0.

## Structure

- `/host` - Host application (consumer)
- `/remote` - Remote application (provider)
- `/shared` - Shared libraries

## Key Features

- Uses Module Federation 2.0 via `@module-federation/enhanced` plugin
- Integrated with Zephyr via `zephyr-rspack-plugin`
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
pnpm start
```

This will build and start the remote server on http://localhost:3002

#### Host Application

```bash
cd host
pnpm build
pnpm start
```

This will build and start the host server on http://localhost:3001

## Integration with Zephyr

This example uses Zephyr to handle proper versioning and distribution of federated modules. Key integration points:

1. The `withZephyr` wrapper around ModuleFederationPlugin in the configuration:

```js
withZephyr(new ModuleFederationPlugin({
  // MF configuration
}))
```

2. Automatic handling of Module Federation 2.0 features including:
   - Container API for versioned module loading
   - Enhanced shared module resolution
   - Proper handling of scope overrides

## Testing

This example is included in the Zephyr testing matrix and is automatically tested for compatibility with each new version.