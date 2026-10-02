# Examples Resume

Use this file when the user wants concrete Zephyr setup examples for frontend stacks.

## Fast starting points

- Vite SPA: `https://github.com/ZephyrCloudIO/zephyr-examples/tree/main/bundlers/react-vite`
- Rspack SPA: `https://github.com/ZephyrCloudIO/zephyr-examples/tree/main/bundlers/react-rspack`
- TanStack Start: `https://github.com/ZephyrCloudIO/zephyr-examples/tree/main/frameworks/tanstack-start`
- Astro: `https://github.com/ZephyrCloudIO/zephyr-examples/tree/main/frameworks/astro`
- Cross-bundler MF: `https://github.com/ZephyrCloudIO/zephyr-examples/tree/main/module-federation/react-vite-rspack-webpack`
- Monorepo MF: `https://github.com/ZephyrCloudIO/zephyr-examples/tree/main/build-systems/turborepo-rspack-mf`

Repo root: `https://github.com/ZephyrCloudIO/zephyr-examples`

## Core pattern

- Install the Zephyr integration that matches the stack.
- Add `withZephyr()` as the last plugin, or wrap the final config with `withZephyr()`.
- For special frameworks, use the framework-specific Zephyr integration instead of the generic bundler plugin.

## Good references

### Minimal Vite

File: `https://github.com/ZephyrCloudIO/zephyr-examples/blob/main/bundlers/react-vite/vite.config.ts`

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { withZephyr } from 'vite-plugin-zephyr';

export default defineConfig({
  plugins: [react(), withZephyr()],
});
```

### Minimal Rspack

File: `https://github.com/ZephyrCloudIO/zephyr-examples/blob/main/bundlers/react-rspack/rspack.config.ts`

```ts
import { defineConfig } from '@rspack/cli';
import { withZephyr } from 'zephyr-rspack-plugin';

const config = defineConfig({
  entry: { main: './src/main.tsx' },
});

export default withZephyr()(config);
```

### TanStack Start

File: `https://github.com/ZephyrCloudIO/zephyr-examples/blob/main/frameworks/tanstack-start/vite.config.ts`

```ts
import { withZephyr } from 'vite-plugin-tanstack-start-zephyr';

plugins: [tanstackStart(), viteReact(), withZephyr()];
```

### Astro

File: `https://github.com/ZephyrCloudIO/zephyr-examples/blob/main/frameworks/astro/astro.config.mjs`

```js
import { defineConfig } from 'astro/config';
import { withZephyr } from 'zephyr-astro-integration';

export default defineConfig({
  integrations: [mdx(), sitemap(), withZephyr()],
});
```

## Gotchas worth reusing

- Use the framework-specific integration when one exists.
- Build remotes before hosts in MF setups.
- Do not assume every example uses the same remote manifest format.
- Cross-bundler MF hosts may need explicit remote `type` values.
