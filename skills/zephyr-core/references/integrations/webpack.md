# Configure webpack for Zephyr

## Setup

Read the application's existing webpack config, its export shape (object,
array, or function), and installed versions before editing. Keep its entries,
loaders, HTML plugin, and output settings. If `zephyr-webpack-plugin` is
missing, install it as a development dependency only when dependency changes
are authorized. The package peers on `webpack` ^5.0.0.

`withZephyr(options?)` returns an async function that takes the final config and
resolves to the same config with Zephyr's plugin appended. Export that promise:

```typescript
import type { Configuration } from 'webpack';
import { withZephyr } from 'zephyr-webpack-plugin';

const config: Configuration = {
  // existing entry, output, loaders, and plugins
};

export default withZephyr()(config);
```

A function config can return `withZephyr()({ ... })` the same way. The supported
options are `target` (`web`, `ios`, `android`, or `tap-app`), `wait_for_index_html`,
`hooks.onDeployComplete`, and, for config arrays only, `snapshotType` and
`entrypoint`. Options prefixed with `__` are reserved for framework adapters.

## Configure Module Federation

Keep the application's existing federation plugin. Add it to `plugins` before
the config reaches `withZephyr()`; Zephyr reads federation plugins from
`config.plugins` when the wrapper runs:

```typescript
import { ModuleFederationPlugin } from '@module-federation/enhanced/webpack';
import type { Configuration } from 'webpack';
import { withZephyr } from 'zephyr-webpack-plugin';

const config: Configuration = {
  plugins: [
    new ModuleFederationPlugin({
      name: 'catalog',
      filename: 'remoteEntry.js',
      exposes: { './Product': './src/Product.tsx' },
    }),
  ],
};

export default withZephyr()(config);
```

Webpack's built-in `container.ModuleFederationPlugin` is also detected. In Nx
`composePlugins(...)`, put `withZephyr()` after `withModuleFederation(...)`.

Zephyr resolves remotes declared in the plugin together with the package's
`zephyr:dependencies`, then rewrites matched remotes. A remote that cannot be
resolved is logged as a warning and keeps its declared URL. The
`zephyr-module-federation` skill covers dependency
declarations and host/remote build order.

## Choose the publication shape

A single config publishes its own snapshot. An exported array is wrapped once
and coordinated as one logical build: one engine, one snapshot after every
compiler succeeds. For arrays, SSR layouts, `wait_for_index_html`, base paths,
and failure semantics, read [compiler arrays and publication](webpack-compiler-arrays.md).

## Avoid misleading fixes

- Do not add federation plugins after wrapping, for example in a later
  `composePlugins` step. Zephyr will not see their remotes or exposes.
- Do not wrap each element of a config array separately. That creates
  independent publications instead of one coordinated snapshot.
- Do not pass `deploy` or `environment`. The README shows them, but they are not
  options; choose environments in Zephyr, as the
  [deployment model](../deployment-model.md) describes.
- Do not use this package for Rspack. `zephyr-rspack-plugin` identifies the
  Rspack builder and adds Rspack-only `ZE_PUBLIC_*` handling.
- Do not treat a finished webpack build as a deployment. Single-config
  publication errors are logged and the build continues unless
  `ZE_FAIL_BUILD=true` is set.
- Do not put credentials in `ZE_PUBLIC_*`; those values are client-visible.

## Verify completion

Run the authorized production build with the application's existing package
runner. Confirm the expected assets are emitted and Zephyr reports a successful
publication with a version URL. A compilation with errors is never uploaded. A
build without credentials can establish local asset correctness, but not live
deployment success. Report that distinction.

On failure, keep the actionable error and fix the matching configuration or
publication issue. Do not silently drop federation plugins, suppress errors, or
claim that a partial build was deployed.
