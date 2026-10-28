# zephyr-astro-integration

Astro integration for Zephyr Cloud deployment and analytics platform.

## Installation

```bash
npm install zephyr-astro-integration
# or
pnpm add zephyr-astro-integration
# or
yarn add zephyr-astro-integration
```

## AI Agent Skills (Optional)

The `zephyr-core` Agent Skill teaches AI coding agents how to set up and debug
this package, with a dedicated
[Astro guide](https://github.com/ZephyrCloudIO/skills/blob/main/skills/zephyr-core/references/integrations/astro.md).
Zephyr does not need it at runtime. Add it to your project with the
[`skills` CLI](https://github.com/vercel-labs/skills):

```sh
npx skills add ZephyrCloudIO/skills --skill zephyr-core
```

Add `--skill zephyr-module-federation` if the application uses Module Federation.

## Usage

Add the integration to your `astro.config.mjs`:

```js
import { defineConfig } from 'astro/config';
import { withZephyr } from 'zephyr-astro-integration';

export default defineConfig({
  integrations: [
    withZephyr({
      // Integration options (if needed)
    }),
  ],
});
```

## Features

- **Automated Asset Upload**: Automatically uploads your Astro build assets to Zephyr Cloud
- **Build Analytics**: Provides detailed build statistics and performance metrics
- **Easy Integration**: Simple one-line addition to your Astro configuration
- **Build Optimization**: Integrates with Zephyr's optimization pipeline

## How it Works

The integration hooks into Astro's build lifecycle:

1. **Setup Phase**: Initializes the Zephyr engine during Astro config setup
2. **Build Phase**: Monitors the build process and collects metrics
3. **Post-Build Phase**: Extracts built assets and uploads them to Zephyr Cloud
4. **Analytics**: Generates build statistics for the Zephyr dashboard

## Configuration

The integration works out of the box without additional configuration. For advanced use cases, you can pass options to customize behavior:

```js
withZephyr({
  // Publish a TAP package rather than the default web artifact.
  target: 'tap-app',
});
```

`target` accepts the Zephyr artifact families (`web`, `ios`, `android`, and
`tap-app`). Use `tap-app` when the Astro output is part of a TAP package.

### Module Federation metadata

If the package SDK emits multiple Module Federation containers, pass its
JSON-serializable metadata through unchanged:

```ts
withZephyr({
  target: 'tap-app',
  mfConfigs: [
    { name: 'desktop', filename: 'targets/desktop/remoteEntry.mjs' },
    { name: 'quickjs', filename: 'targets/quickjs/remoteEntry.mjs' },
  ],
  federation: [
    { name: 'desktop', remote: 'targets/desktop/remoteEntry.mjs' },
    { name: 'quickjs', remote: 'targets/quickjs/remoteEntry.mjs' },
  ],
});
```

For `tap-app`, both arrays are required and non-empty. Each `mfConfigs` entry
must pair a unique `name` and `filename` with a `federation` entry having the
same `name` and `remote`; publication otherwise fails before upload. The
adapter does not derive or alter SDK metadata. For non-TAP artifacts, both
fields are optional. A complete singleton config also populates the legacy
`mfConfig` snapshot field for backward compatibility.

## Cloudflare SSR preparation

For `output: 'server'` with `@astrojs/cloudflare`, the integration follows the
adapter's generated `.wrangler/deploy/config.json` and collects complete server
and client output. The snapshot carries its server entrypoint and a secret-free
description of binding, asset, compatibility, and cron requirements. Missing
modules, output symlinks, and unsupported capabilities fail the build.

The selected Zephyr runtime must advertise `capabilities.cloudflareDeployment: 1`.
Without it, the upload is refused. The existing managed SSR runtime does not
currently advertise this contract; this preparation path does not by itself
enable live EmDash deployment. Do not substitute an SSG upload for a CMS backend.

Use `ZE_DISABLED=true` to build locally, then inspect output without credentials:

```js
import { collectCloudflareOutput } from 'zephyr-astro-integration';

const { entrypoint, assetsMap, deployment } = await collectCloudflareOutput(process.cwd());
```

See [`fixtures/astro-emdash`](../../fixtures/astro-emdash) for the published-package
fixture, local preview, migration boundary, and deployment prerequisites.

## Requirements

- Astro 4.0 or higher
- Node.js 16 or higher
- Zephyr Cloud account

## License

Apache-2.0
