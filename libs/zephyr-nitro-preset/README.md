# zephyr-nitro-preset

Nitro preset helpers for Zephyr workflows.

Cloudflare-only base preset: `cloudflare_module`.

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
});
```

The preset writes build metadata at `.output/.zephyr/nitro-build.json` by default.

## Workspace examples

- `examples/nitro-preset-cloudflare`
