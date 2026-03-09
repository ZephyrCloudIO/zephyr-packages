# vite-plugin-vinext-zephyr

<div align="center">

[Zephyr Cloud](https://zephyr-cloud.io) | [Zephyr Docs](https://docs.zephyr-cloud.io) | [Discord](https://zephyr-cloud.io/discord) | [Twitter](https://x.com/ZephyrCloudIO) | [LinkedIn](https://www.linkedin.com/company/zephyr-cloud/)

<hr/>
<img src="https://cdn.prod.website-files.com/669061ee3adb95b628c3acda/66981c766e352fe1f57191e2_Opengraph-zephyr.png" alt="Zephyr Logo" />
</div>

A Vite plugin for deploying Vinext applications with Zephyr Cloud.

## Installation

```bash
pnpm add --save-dev vite-plugin-vinext-zephyr
```

## Usage

Add the plugin after `vinext()` in your `vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import vinext from 'vinext';
import { cloudflare } from '@cloudflare/vite-plugin';
import { withZephyr } from 'vite-plugin-vinext-zephyr';

export default defineConfig({
  plugins: [
    vinext(),
    cloudflare({
      viteEnvironment: {
        name: 'rsc',
        childEnvironments: ['ssr'],
      },
    }),
    withZephyr(),
  ],
});
```

## Options

```ts
withZephyr({
  outputDir: 'dist',
  entrypoint: 'server/index.js',
  hooks: {},
});
```

- `outputDir` - Build output directory. Defaults to `dist`.
- `entrypoint` - Optional server entrypoint relative to output directory.
  Auto-detected by default.
- `hooks` - Optional Zephyr deployment lifecycle hooks.

## Entrypoint Auto-Detection

The plugin infers the entrypoint from Vite bundle hooks (`writeBundle`) without reading
the filesystem directly. When `entrypoint` is not provided, it resolves:

1. `dist/server/index.js` for App Router builds.
2. `dist/<worker-dir>/index.js` when `<worker-dir>` contains `wrangler.json` or
   `wrangler.jsonc` (Pages Router builds).

## License

Apache-2.0
