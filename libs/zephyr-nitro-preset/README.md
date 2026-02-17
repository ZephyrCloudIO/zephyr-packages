# zephyr-nitro-preset

Nitro preset helpers for Zephyr workflows.

Cloudflare-only base preset: `cloudflare_module`.

Requires `nitro@^3`.

## Installation

```bash
pnpm add -D zephyr-nitro-preset
```

## Usage with Nitro

```ts
import { defineNitroConfig } from 'nitro/config';

export default defineNitroConfig({
  preset: './preset',
});
```

```ts
// preset/nitro.config.ts
import { createZephyrNitroPreset } from 'zephyr-nitro-preset';

export default createZephyrNitroPreset();
```

## Usage with Nuxt

```ts
export default defineNuxtConfig({
  nitro: {
    preset: './preset',
  },
});
```

## Options

```ts
import { createZephyrNitroPreset } from 'zephyr-nitro-preset';

export default defineNitroConfig({
  preset: './preset',
});
```

```ts
// preset/nitro.config.ts
import { createZephyrNitroPreset } from 'zephyr-nitro-preset';

export default createZephyrNitroPreset({
  metadataFile: '.zephyr/nitro-build.json',
  loggerTag: 'my-nitro-preset',
  deploy: {
    enabled: true,
    // optional; auto-detected from output if omitted
    entrypoint: 'index.mjs',
    ssr: true,
    target: 'web',
  },
});
```

The preset emits build metadata at `.output/server/.zephyr/nitro-build.json` by default.
Metadata is emitted through Nitro bundler lifecycle hooks (`rollup:before` + bundler asset emission), not direct filesystem writes.
The preset also uploads Nitro output to Zephyr on `compiled` by default.

Set `deploy: false` to disable uploads for local-only builds.
Set `deploy.entrypoint` to override SSR entrypoint if your Nitro output differs from defaults.

## Workspace examples

- `examples/nitro-preset-cloudflare`
