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

## Requirements

- Astro 4.0 or higher
- Node.js 16 or higher
- Zephyr Cloud account

## License

Apache-2.0
