# Rolldown Module Federation Example

This example demonstrates how to use Zephyr with Rolldown and Module Federation.

## Structure

- `host` - The host application that consumes the remote component
- `remote` - The remote application that exposes a component

## Running the Example

1. Build and start the remote:

```bash
cd remote
pnpm install
pnpm run dev
```

This will start the remote application on port 8085.

2. In another terminal, build and start the host:

```bash
cd host
pnpm install
pnpm run dev
```

This will start the host application on port 8084.

3. Open your browser to http://localhost:8084 to see the host application consuming the remote component.

## How it Works

The Zephyr Rolldown plugin works alongside Rolldown's native Module Federation plugin:

```js
// In rolldown.config.mjs
import { defineConfig } from 'rolldown';
import { moduleFederationPlugin } from 'rolldown/experimental';
import { withZephyr } from 'zephyr-rolldown-plugin';

export default defineConfig({
  plugins: [
    // First, use Rolldown's native Module Federation plugin
    moduleFederationPlugin({
      name: 'rolldown-remote',
      filename: 'remote-entry.js',
      exposes: {
        './button': './button.jsx',
      },
      shared: {
        react: {
          singleton: true,
        },
      },
      manifest: true,
      getPublicPath: 'http://localhost:8085/',
    }),

    // Then, apply the Zephyr plugin
    withZephyr(),
  ],
});
```

### Key Features

The Zephyr Rolldown plugin enhances Module Federation by:

1. **Automatic Detection** - Automatically finds and processes any module federation configuration
2. **Dependency Resolution** - Resolves remote modules through Zephyr Cloud
3. **Optimized Remote URLs** - Updates remote endpoints to use Zephyr's optimized delivery network
4. **Dashboard Integration** - Provides Module Federation configuration to the Zephyr dashboard
5. **Asset Optimization** - Uploads and manages assets with differential updates

This approach gives you full control over the Module Federation configuration while still benefiting from Zephyr's features.
