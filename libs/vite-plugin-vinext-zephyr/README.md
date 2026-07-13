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
  hooks: {},
});
```

- `outputDir` - Build output directory. Defaults to `dist`.
- `target` - Zephyr artifact family. Use `tap-app` for TAP packages.
- `mfConfigs` - Every Module Federation container included in the snapshot.
- `federation` - Matching build-stat metadata for each `mfConfigs` entry.
- `snapshotType` - `'csr'` or `'ssr'`. TAP packages default to CSR; ordinary Vinext
  deployments default to SSR.
- `entrypoint` - Optional server entrypoint relative to output directory for an SSR
  snapshot. Auto-detected when SSR is selected.
- `hooks` - Optional Zephyr deployment lifecycle hooks.

`target: 'tap-app'` publishes a desktop/mobile/QuickJS ESM package as CSR by default,
without requiring a server entrypoint. To publish a TAP SSR package instead, opt in
explicitly:

```ts
withZephyr({
  target: 'tap-app',
  snapshotType: 'ssr',
  entrypoint: 'server/index.js',
  ...tapFederationMetadata,
});
```

TAP publication requires both non-empty metadata arrays. Every `mfConfigs` item must
have exactly one `federation` item with the same `name` and with
`filename === remote`; mismatched metadata fails before the build starts. Vinext does
not infer this information from framework plugins. A valid singleton is also exposed
through the legacy `mfConfig` field for older consumers; multi-container packages use
only the complete `mfConfigs` array.

## Entrypoint Auto-Detection

The plugin waits for Vinext's post-ordered `buildApp` phase, verifies every Vite child
environment completed, then scans the finalized output tree. Ordinary Vinext deployments
include the generated RSC manifest and Worker-compatible import cleanup. With
`target: 'tap-app'`, the finalized tree is transported verbatim instead: no Node-import
rewriting and no synthesized RSC manifest. CSR transport does not inspect a server entry.
When `snapshotType: 'ssr'` is selected and `entrypoint` is not provided, it resolves
JavaScript, ESM, and CommonJS entries from:

1. `dist/server/index.js` for App Router builds.
2. `dist/<worker-dir>/index.*` when `<worker-dir>` contains `wrangler.json` or
   `wrangler.jsonc` (Pages Router builds).

## License

Apache-2.0
