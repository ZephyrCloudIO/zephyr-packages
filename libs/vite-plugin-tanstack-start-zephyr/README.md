# vite-plugin-tanstack-start-zephyr

![Vite compatibility](https://registry.vite.dev/api/badges?package=vite-plugin-tanstack-start-zephyr&tool=vite)

Vite plugin for deploying TanStack Start applications to Zephyr with SSR support.

## Overview

This plugin runs after TanStack Start finishes building, packages the `dist/`
output, and uploads the server and client assets to Zephyr for SSR deployment.

## Installation

```bash
pnpm add -D vite-plugin-tanstack-start-zephyr
```

## Usage

Add the plugin to your `vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import { withZephyr } from 'vite-plugin-tanstack-start-zephyr';

export default defineConfig({
  plugins: [tanstackStart(), withZephyr()],
});
```

## Configuration

The plugin delegates Zephyr app detection and auth to `zephyr-agent`. In most
projects, `withZephyr()` is enough.

### Plugin options

| Option       | Type     | Required | Description                                                          |
| ------------ | -------- | -------- | -------------------------------------------------------------------- |
| `outputDir`  | `string` | No       | Build output root. Defaults to `dist/`.                              |
| `entrypoint` | `string` | No       | Server entry relative to `outputDir`. Defaults to `server/index.js`. |

Example with overrides:

```typescript
withZephyr({
  outputDir: 'dist',
  entrypoint: 'server/index.js',
});
```

## How It Works

1. **Build**: TanStack Start writes its output to `dist/`
2. **Extract**: Plugin collects server modules and client assets
3. **Bundle**: Server code is bundled with all dependencies
4. **Upload**: Both server and client files are uploaded to Zephyr
5. **Deploy**: Files are stored in content-addressable KV storage
6. **Run**: Orchestration worker loads and runs your app on the edge

## Build Output

The plugin processes TanStack Start's build output:

```
dist/
├── server/           # Server-side code
│   ├── index.js     # Main entry point
│   └── assets/      # Server bundles
└── client/          # Client-side assets
    └── assets/      # Client bundles
```

## Deployment Architecture

Your app runs in Cloudflare's orchestration worker using dynamic worker loaders:

```
Request → Orchestration Worker → Load Your App (Isolate) → Response
```

Features:

- ✅ Multiple versions live simultaneously
- ✅ Content-addressable storage (efficient caching)
- ✅ SSR and API routes support
- ✅ Hot swapping without redeployment
- ✅ Per-version isolation

## Development

### Build Plugin

```bash
cd libs/vite-plugin-tanstack-start-zephyr
pnpm build
```

### Run Tests

```bash
pnpm test
```

### Link Locally

```bash
pnpm link --global
# In your project
pnpm link --global vite-plugin-tanstack-start-zephyr
```

## Requirements

- Node.js version supported by Vite 7 and TanStack Start 1.x
- TanStack Start 1.0+
- Vite 7+

## License

Apache-2.0

## Related

- [@tanstack/start](https://tanstack.com/start) - TanStack Start framework
- [zephyr-agent](../zephyr-agent) - Core Zephyr upload library
- [vite-plugin-zephyr](../vite-plugin-zephyr) - Static site Vite plugin
