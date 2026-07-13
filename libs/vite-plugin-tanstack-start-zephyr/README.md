# vite-plugin-tanstack-start-zephyr

![Vite compatibility](https://registry.vite.dev/api/badges?package=vite-plugin-tanstack-start-zephyr&tool=vite)

Vite plugin for deploying TanStack Start applications to Zephyr with SSR and TAP CSR
support.

## Overview

This plugin runs after TanStack Start finishes building, packages the `dist/`
output, and uploads it as an SSR deployment or a TAP CSR package.

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

| Option         | Type             | Required | Description                                                              |
| -------------- | ---------------- | -------- | ------------------------------------------------------------------------ |
| `target`       | `string`         | No       | Zephyr artifact family; use `tap-app` for TAP packages.                  |
| `mfConfigs`    | `array`          | TAP      | Every Module Federation container included in the snapshot.              |
| `federation`   | `array`          | TAP      | Matching build-stat metadata for each `mfConfigs` entry.                 |
| `outputDir`    | `string`         | No       | Build output root. Defaults to `dist/`.                                  |
| `snapshotType` | `'csr' \| 'ssr'` | No       | TAP defaults to CSR; ordinary TanStack Start deployments default to SSR. |
| `entrypoint`   | `string`         | No       | Server entry relative to `outputDir`, used only for an SSR snapshot.     |

Example with overrides:

```typescript
const tapFederationMetadata = {
  mfConfigs: [
    { name: 'desktop', filename: 'targets/desktop/remoteEntry.mjs', library: { type: 'module' } },
    { name: 'mobile', filename: 'targets/mobile/remoteEntry.mjs', library: { type: 'module' } },
    { name: 'quickjs', filename: 'targets/quickjs/remoteEntry.mjs', library: { type: 'module' } },
  ],
  federation: [
    { name: 'desktop', remote: 'targets/desktop/remoteEntry.mjs', library_type: 'module' },
    { name: 'mobile', remote: 'targets/mobile/remoteEntry.mjs', library_type: 'module' },
    { name: 'quickjs', remote: 'targets/quickjs/remoteEntry.mjs', library_type: 'module' },
  ],
};

withZephyr({
  target: 'tap-app',
  outputDir: 'dist',
  ...tapFederationMetadata,
});
```

TAP output is uploaded as a CSR package by default, so a desktop/mobile/QuickJS ESM
package does not need a `server/index.js`. To publish an actual SSR package, opt in
explicitly:

```typescript
withZephyr({
  target: 'tap-app',
  snapshotType: 'ssr',
  entrypoint: 'server/index.js',
  ...tapFederationMetadata,
});
```

TAP publication requires both non-empty metadata arrays. Every `mfConfigs` item must
have exactly one `federation` item with the same `name` and with
`filename === remote`; mismatched metadata fails before the build starts. TanStack
Start does not infer this information from framework plugins. A valid singleton is
also exposed through the legacy `mfConfig` field for older consumers; multi-container
packages use only the complete `mfConfigs` array.

## How It Works

1. **Build**: TanStack Start owns and completes its client/server child compilers
2. **Finalize**: The plugin's post-ordered `buildApp` hook waits for framework post-processing
3. **Extract**: The plugin collects the finalized shared output tree once
4. **Upload**: Server, client, public, and prerendered files are uploaded as one snapshot
5. **Deploy**: Files are stored in content-addressable KV storage
6. **Run**: Orchestration worker loads and runs your app on the edge

The plugin never starts TanStack's child compilers itself and refuses to publish when an
environment is incomplete.

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

- Node.js version supported by Vite 7 or 8 and TanStack Start 1.x
- TanStack Start 1.0+
- Vite 7 or 8

## License

Apache-2.0

## Related

- [@tanstack/start](https://tanstack.com/start) - TanStack Start framework
- [zephyr-agent](../zephyr-agent) - Core Zephyr upload library
- [vite-plugin-zephyr](../vite-plugin-zephyr) - Static site Vite plugin
