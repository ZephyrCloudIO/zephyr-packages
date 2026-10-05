# SDK Setup

Use this file when the user asks how to add Zephyr to a frontend project, which SDK/plugin to install, or whether `with-zephyr` can wire up an existing app.

## Fastest path

For an existing app, start with the codemod:

```bash
curl -fsSL https://with.zephyr-cloud.io | node
```

Other launch forms:

```bash
npx with-zephyr
yarn dlx with-zephyr
pnpx with-zephyr
bunx with-zephyr
```

Why: the codemod detects the stack and makes the smallest setup change for supported bundlers/frameworks.

## Minimal prerequisites

- A Zephyr account or org/app access path
- A git repository with a remote, branch, and commit
- A supported Zephyr SDK path, or a build output directory for `zephyr-agent`

## What happens after `with-zephyr`

- It detects the stack and usually adds the matching Zephyr integration to the project config.
- It may add or update the relevant build config file for the bundler/framework.
- The next step is normally just to run the app's build command.
- After a successful Zephyr-enabled build, look for the version URL in the build output/logs.

## SDK picker

For optional human/AI provenance, the codemod also offers **Change Attribution**
and links to Git AI installation. Enabling capture and installing project agent
hooks are separate choices. Read [Change Attribution](change-attribution.md) for
consent, supported integrations, dirty-source records, and coverage limits.

Use the official picker doc first:

- Docs page: `https://docs.zephyr-cloud.io/getting-started/find-your-sdk`
- Raw markdown: `https://docs.zephyr-cloud.io/getting-started/find-your-sdk.md`
- Source: `https://docs.zephyr-cloud.io/getting-started/find-your-sdk.md`

Current mapping:

| Stack             | SDK                                 |
| ----------------- | ----------------------------------- |
| Vite              | `vite-plugin-zephyr`                |
| Webpack           | `zephyr-webpack-plugin`             |
| Rspack            | `zephyr-rspack-plugin`              |
| Rsbuild / Rslib   | `zephyr-rsbuild-plugin`             |
| Rstack app / lib  | `zephyr-rsbuild-plugin`             |
| Rstack doc        | `zephyr-rspress-plugin`             |
| Rollup            | `rollup-plugin-zephyr`              |
| Rolldown          | `zephyr-rolldown-plugin`            |
| Parcel            | `parcel-reporter-zephyr`            |
| Metro             | `zephyr-metro-plugin`               |
| Re.Pack           | `zephyr-repack-plugin`              |
| Astro             | `zephyr-astro-integration`          |
| Modern.js         | `zephyr-modernjs-plugin`            |
| Nitro v3          | built-in `preset: 'zephyr'`         |
| Nuxt              | `zephyr-nuxt-module`                |
| Rspress           | `zephyr-rspress-plugin`             |
| Ember.js via Vite | `vite-plugin-zephyr`                |
| TanStack Start    | `vite-plugin-tanstack-start-zephyr` |
| Vinext            | `vite-plugin-vinext-zephyr`         |

Fallback for unsupported stacks:

```ts
import { uploadOutputToZephyr } from 'zephyr-agent';

await uploadOutputToZephyr({
  rootDir: process.cwd(),
  outputDir: '.output',
  ssr: true,
});
```

For a build command or prebuilt directory without a bundler integration, the
`zephyr-cli` package wraps the command and uploads its output:

```bash
ze-cli pnpm build
ze-cli deploy ./dist
```

Use these fallbacks when there is no official Zephyr SDK for the stack, but the project still produces a deployable output directory. They are the low-level integration paths for custom frameworks and internal tooling.

Minimum assumption: Zephyr still needs a real built output directory and enough app/build context to upload it correctly.

## Smallest working examples

Vite:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { withZephyr } from 'vite-plugin-zephyr';

export default defineConfig({
  plugins: [react(), withZephyr()],
});
```

Source example: `https://github.com/ZephyrCloudIO/zephyr-examples/blob/main/bundlers/react-vite/vite.config.ts`

Rspack:

```ts
import { defineConfig } from '@rspack/cli';
import { withZephyr } from 'zephyr-rspack-plugin';

const config = defineConfig({
  entry: { main: './src/main.tsx' },
});

export default withZephyr()(config);
```

Source example: `https://github.com/ZephyrCloudIO/zephyr-examples/blob/main/bundlers/react-rspack/rspack.config.ts`

TanStack Start:

```ts
import { withZephyr } from 'vite-plugin-tanstack-start-zephyr';

plugins: [tanstackStart(), viteReact(), withZephyr()];
```

Source example: `https://github.com/ZephyrCloudIO/zephyr-examples/blob/main/frameworks/tanstack-start/vite.config.ts`

Astro:

```js
import { defineConfig } from 'astro/config';
import { withZephyr } from 'zephyr-astro-integration';

export default defineConfig({
  integrations: [mdx(), sitemap(), withZephyr()],
});
```

Source example: `https://github.com/ZephyrCloudIO/zephyr-examples/blob/main/frameworks/astro/astro.config.mjs`

## Important setup notes

For Rstack CLI, run `pnpm dlx with-zephyr --bundlers rstack --dry-run` before
applying the same command without `--dry-run`. The codemod discovers
`rstack.config.ts`, `.js`, `.mts`, and `.mjs`, then configures `define.app()`,
`define.lib()`, and `define.doc()` independently. It preserves other tool
sections and existing plugins, reuses imported Zephyr aliases, and adds each
dependency to the nearest project manifest. Inline objects and configuration
functions returning inline objects are supported; imported configurations and
spreads without explicit `plugins`, or placed after `plugins`, require manual setup. Custom config filenames
are not discovered. Use the existing Rsbuild or Rspress plugin, not a separate
Rstack package. If local builds must not deploy, explicitly gate the plugin in
the deployment workflow rather than assuming the codemod makes builds read-only.

Malformed Rstack files are isolated to that file; other selected configurations
still run. The bundler filter excludes other tools before parsing their files.

- Plugin placement is stack-specific, not globally “always last”.
- Nx compose-plugin setups usually put Zephyr last in the composition.
- Vite Module Federation and framework-specific integrations can require a specific order; verify against the stack docs/example before moving plugins around.
- For existing apps, prefer the codemod before hand-editing configs.
- Git context matters for deployment identity: repo, branch, and commit need to exist.
- If docs disagree on Rspack naming, prefer `zephyr-rspack-plugin` from the SDK picker and examples.

## Important availability caveats

- Astro integration is static-only. Do not present it as a general SSR deployment path.
- Nitro v3, Nuxt, and TanStack Start SSR-style paths are currently constrained to Zephyr's managed Cloudflare path in the public docs.
- If the user needs unsupported SSR behavior or a custom runtime, verify whether `zephyr-agent` output upload is a better fit than an official framework SDK.

## Best docs to link

- Quick start: `https://docs.zephyr-cloud.io/getting-started/quick-start.md`
- SDK picker: `https://docs.zephyr-cloud.io/getting-started/find-your-sdk.md`
- Existing app integration: `https://docs.zephyr-cloud.io/integrations/existing-app.md`
- Vite: `https://docs.zephyr-cloud.io/bundlers/vite.md`
- llms index: `https://docs.zephyr-cloud.io/llms.txt`
