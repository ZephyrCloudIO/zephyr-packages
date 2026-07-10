# Vite Plugin Zephyr

![Vite compatibility](https://registry.vite.dev/api/badges?package=vite-plugin-zephyr&tool=vite)

<div align="center">

[Zephyr Cloud](https://zephyr-cloud.io) | [Zephyr Docs](https://docs.zephyr-cloud.io) | [Discord](https://zephyr-cloud.io/discord) | [Twitter](https://x.com/ZephyrCloudIO) | [LinkedIn](https://www.linkedin.com/company/zephyr-cloud/)

<hr/>
<img src="https://cdn.prod.website-files.com/669061ee3adb95b628c3acda/66981c766e352fe1f57191e2_Opengraph-zephyr.png" alt="Zephyr Logo" />
</div>

A Vite plugin for deploying applications with Zephyr Cloud. This plugin integrates with Vite's build process to enable seamless deployment of your applications, with optional Module Federation support. Read more from our documentation [here](https://docs.zephyr-cloud.io/integrations/react-vite).

## Get Started

The fastest way to get started is to use `create-zephyr-apps` to generate a new Vite application with Zephyr integration and there are various vite examples available:

```bash
npx create-zephyr-apps@latest
```

## Installation

```bash
# npm
npm install --save-dev vite-plugin-zephyr

# yarn
yarn add --dev vite-plugin-zephyr

# pnpm
pnpm add --dev vite-plugin-zephyr

# bun
bun add --dev vite-plugin-zephyr
```

## Usage

### Basic Configuration

Add the plugin to your Vite configuration:

```javascript
// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { withZephyr } from 'vite-plugin-zephyr';

export default defineConfig({
  plugins: [react(), withZephyr()],
  build: {
    target: 'chrome89',
  },
});
```

### Multi-Environment and SSR Builds

Vite 6, 7, and 8 environment builds are collected across `client`, `server`, RSC, or custom
child environments and published once after `buildApp` completes. The plugin validates
that each current environment contributed output; persisted partial-build contributions
are merged atomically. Vite 5 and watch builds use the direct single-environment upload
path.

```typescript
withZephyr({
  snapshotType: 'ssr',
  entrypoint: 'server/index.mjs',
});
```

- `snapshotType` overrides automatic CSR/SSR detection.
- `entrypoint` is relative to the shared snapshot root and is required when an SSR entry
  cannot be inferred.

For intentionally separate Vite invocations, use `withZephyrPartial()` in producer
configs and `withZephyr()` in the final config. Give every producer and finalizer the
same `invocationId` (or set `ZE_BUILD_INVOCATION_ID`). To derive that identity from a
supported CI job, explicitly pass `partialBuild: {}` to the finalizer; an ordinary
`withZephyr()` build ignores ambient CI metadata. The plugin fails closed when a producer
has no shared build identity. Partial maps are isolated by invocation and generation,
protected by an inter-process lock, and claimed transactionally. Commit removes only
unchanged claimed revisions, while rollback releases the claim without overwriting a
newer concurrent write.

```typescript
withZephyrPartial({ invocationId: process.env.BUILD_ID });
withZephyr({ partialBuild: { invocationId: process.env.BUILD_ID } });
```

For builds with no user-defined `base`, the plugin defaults Vite to `./`. Relative build
asset URLs work for hostname deployments and allow Zephyr to add a path prefix later.
Explicit bases are preserved; an origin-absolute base such as `/docs/` produces a warning
when the application or one of its environments uses path addressing because that URL
cannot be relocated under another prefix.

This build-time default does not by itself make deep SSR/RSC routes prefix-aware. Runtime
HTML generation must still resolve asset URLs against the request/deployment base. The
specialized TanStack Start and Vinext plugins coordinate that runtime output separately.

### With Module Federation

For microfrontend applications using Module Federation:

```javascript
// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { federation } from '@module-federation/vite';
import { withZephyr } from 'vite-plugin-zephyr';

const mfConfig = {
  name: 'my-app',
  remotes: {
    shared: 'shared@http://localhost:3001/remoteEntry.js',
  },
  shared: {
    react: { singleton: true },
    'react-dom': { singleton: true },
  },
};

export default defineConfig({
  plugins: [react(), federation(mfConfig), withZephyr()],
  build: {
    target: 'chrome89',
  },
});
```

### TypeScript Configuration

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { federation, type ModuleFederationOptions } from '@module-federation/vite';
import { withZephyr } from 'vite-plugin-zephyr';

const mfConfig: ModuleFederationOptions = {
  name: 'host-app',
  remotes: {
    'remote-app': 'remoteApp@http://localhost:3001/remoteEntry.js',
  },
  shared: {
    react: { singleton: true },
    'react-dom': { singleton: true },
  },
};

export default defineConfig({
  plugins: [react(), federation(mfConfig), withZephyr()],
  build: {
    target: 'chrome89',
  },
});
```

## Features

- 🚀 Seamless deployment during Vite build
- 🏗️ Optional Module Federation support via [@module-federation/vite](https://github.com/module-federation/vite)
- 📦 Asset optimization and caching
- 🔧 Zero-config setup for simple applications
- 📊 Build analytics and monitoring
- 🌐 Global CDN distribution
- ⚡ Hot module replacement in development

## Module Federation Support

When you need federation, this plugin works with the official [vite plugin from Module Federation](https://github.com/module-federation/vite), providing:

- **Host Applications**: Consume remote modules from other applications
- **Remote Applications**: Expose modules for consumption by host applications
- **Shared Dependencies**: Efficient sharing of common libraries
- **Dynamic Imports**: Runtime loading of remote modules

## Getting Started

1. Install the plugin in your Vite project
2. Add it to your Vite configuration
3. Configure Module Federation (if needed) for microfrontends
4. Build your application with `vite build`
5. Your app will be automatically deployed to Zephyr Cloud

## Build Scripts

Add these scripts to your `package.json`:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

## Requirements

- Vite 5.x, 6.x, 7.x, or 8.x
- Rollup 4.x
- Node.js version supported by your Vite toolchain
- Zephyr Cloud account (sign up at [zephyr-cloud.io](https://zephyr-cloud.io))

If you use Module Federation, also install `@module-federation/vite`.

## Examples

Check out our [examples directory](../../examples/) for complete working examples:

- [vite-react-ts](../../examples/vite-react-ts/) - Basic React + TypeScript setup
- [vite-react-mf](../../examples/vite-react-mf/) - Module Federation setup with host and remote

## Contributing

We welcome contributions! Please read our [contributing guidelines](../../CONTRIBUTING.md) for more information.

## License

Licensed under the Apache-2.0 License. See [LICENSE](LICENSE) for more information.
