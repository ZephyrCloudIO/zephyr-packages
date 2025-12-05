# vite-plugin-tanstack-start-zephyr

Vite plugin for deploying TanStack Start applications to Zephyr with SSR support.

## Overview

This plugin automatically bundles and uploads your TanStack Start application to Zephyr's edge network during the build process. It supports server-side rendering (SSR) and enables multiple versions of your application to run simultaneously.

## Installation

```bash
pnpm add vite-plugin-tanstack-start-zephyr
```

## Usage

Add the plugin to your `vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import { TanStackStartVite } from '@tanstack/start/vite';
import { withZephyrTanstackStart } from 'vite-plugin-tanstack-start-zephyr';

export default defineConfig({
  plugins: [
    TanStackStartVite(),
    withZephyrTanstackStart({
      appUid: 'my-app-uid',
      environment: 'production',
      apiEndpoint: 'https://api.zephyrcloud.app',
      apiKey: process.env.ZEPHYR_API_KEY,
    }),
  ],
});
```

## Configuration

### Options

| Option        | Type     | Required | Description                                    |
| ------------- | -------- | -------- | ---------------------------------------------- |
| `appUid`      | `string` | Yes      | Your application's unique identifier           |
| `environment` | `string` | No       | Deployment environment (default: 'production') |
| `apiEndpoint` | `string` | No       | Zephyr API endpoint                            |
| `apiKey`      | `string` | No       | API key for authentication                     |

### Environment Variables

You can also configure the plugin using environment variables:

- `ZE_APP_UID` - Application UID
- `ZE_API_ENDPOINT` - API endpoint
- `ZE_API_KEY` - API key
- `ZE_ENVIRONMENT` - Deployment environment

## How It Works

1. **Build**: TanStack Start builds your app to `.output/` directory
2. **Extract**: Plugin collects server modules and client assets
3. **Bundle**: Server code is bundled with all dependencies
4. **Upload**: Both server and client files are uploaded to Zephyr
5. **Deploy**: Files are stored in content-addressable KV storage
6. **Run**: Orchestration worker loads and runs your app on the edge

## Build Output

The plugin processes TanStack Start's build output:

```
.output/
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

- Node.js 18+
- TanStack Start 1.0+
- Vite 5+

## License

MIT

## Related

- [@tanstack/start](https://tanstack.com/start) - TanStack Start framework
- [zephyr-agent](../zephyr-agent) - Core Zephyr upload library
- [vite-plugin-zephyr](../vite-plugin-zephyr) - Static site Vite plugin
