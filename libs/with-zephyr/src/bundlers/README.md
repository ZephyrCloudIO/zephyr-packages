# Bundler Configurations

Each file in this directory defines how a bundler should be transformed.

The old `patterns + regex + transformer-name` schema has been replaced with an
**ordered operation strategy**.

## Schema

```ts
export interface BundlerConfig {
  files: string[];
  plugin: string;
  importName: string | null;
  strategy: 'first-success' | 'run-all';
  operations: BundlerOperationId[];
}
```

## Strategy Semantics

- `first-success`: run operations in order and stop at first successful rewrite.
- `run-all`: run every operation in order (used for additive behavior like RSBuild).

## Common Operation IDs

- `compose-plugins`
- `plugins-array`
- `plugins-array-or-create`
- `nuxt-modules-or-create`
- `wrap-module-exports`
- `wrap-module-exports-async`
- `wrap-export-default-async`
- `wrap-export-default-define-config`
- `wrap-export-default-object`
- `rollup-function`
- `rollup-array`
- `astro-integrations-function-or-create`
- `astro-integrations-or-create`
- `rsbuild-asset-prefix`
- `wrap-exported-function`
- `parcel-reporters`

## Example

```ts
export const webpackConfig: BundlerConfig = {
  files: ['webpack.config.js', 'webpack.config.ts', 'webpack.config.mjs'],
  plugin: 'zephyr-webpack-plugin',
  importName: 'withZephyr',
  strategy: 'first-success',
  operations: ['compose-plugins', 'plugins-array', 'wrap-module-exports'],
};
```

## Adding a New Bundler

1. Create `src/bundlers/<name>.ts` with `BundlerConfig`.
2. Register it in `src/bundlers/index.ts`.
3. Reuse existing operation IDs where possible.
4. Add/extend tests in `src/tests/bundler-configs.test.ts` and `src/tests/codemod.test.ts`.
5. If needed, add a new operation handler in `src/operations.ts` and extend `BundlerOperationId`.
