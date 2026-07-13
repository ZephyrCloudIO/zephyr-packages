# Zephyr Nuxt Module

A Nuxt module for deploying Nuxt applications with Zephyr Cloud. It uploads the Nitro build output to Zephyr during `nuxt build`.

## Installation

```bash
# npm
npm install --save-dev zephyr-nuxt-module

# yarn
yarn add --dev zephyr-nuxt-module

# pnpm
pnpm add --dev zephyr-nuxt-module

# bun
bun add --dev zephyr-nuxt-module
```

## Usage

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['zephyr-nuxt-module'],
});
```

### Options

```ts
export default defineNuxtConfig({
  modules: ['zephyr-nuxt-module'],
  zephyr: {
    // Publish a TAP package rather than the default web artifact
    target: 'tap-app',
    // JSON-serializable metadata from the package SDK
    mfConfigs: [
      { name: 'desktop', filename: 'targets/desktop/remoteEntry.mjs' },
      { name: 'quickjs', filename: 'targets/quickjs/remoteEntry.mjs' },
    ],
    federation: [
      { name: 'desktop', remote: 'targets/desktop/remoteEntry.mjs' },
      { name: 'quickjs', remote: 'targets/quickjs/remoteEntry.mjs' },
    ],
    // Override Nitro output dir (defaults to nitro.options.output.dir)
    outputDir: '.output',
    // Explicit SSR entrypoint (relative to outputDir)
    entrypoint: 'server/index.mjs',
    // Force snapshot type: 'ssr' or 'csr'
    snapshotType: 'ssr',
    // Optional Zephyr build hooks
    // hooks: { onDeployComplete(info) { ... } }
  },
});
```

## Notes

- If no entrypoint is found, the module falls back to a CSR snapshot.
- Entry points are auto-detected from `server/index.mjs`, `server/index.js`, or `server/index.cjs` when not provided.
- Upload logic is skipped during `nuxt prepare` (including `postinstall` hooks).
- For `target: 'tap-app'`, `mfConfigs` and `federation` are required, non-empty
  arrays. Each unique config `name` and `filename` must match a metadata
  entry's `name` and `remote`; the module fails before upload when that pairing
  is incomplete. It forwards this caller-provided SDK metadata unchanged. For
  non-TAP builds the fields remain optional. A complete singleton config also
  fills the legacy `mfConfig` snapshot field.

## License

Licensed under the Apache-2.0 License. See [LICENSE](LICENSE).
