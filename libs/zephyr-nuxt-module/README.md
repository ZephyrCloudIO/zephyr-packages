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

## License

Licensed under the Apache-2.0 License. See [LICENSE](LICENSE).
