---
name: zephyr-rspack
description: Configure and deploy Rspack applications with zephyr-rspack-plugin;
  use when wrapping an rspack.config with withZephyr, connecting an existing
  Module Federation plugin or Nx composePlugins chain, publishing Rspack config
  arrays or SSR builds, or diagnosing ZE_PUBLIC_* rewrites and missing
  publications. Use zephyr-rsbuild-plugin or zephyr-modernjs-plugin for those
  frameworks.
metadata:
  library: zephyr-rspack-plugin
  library_version: '1.5.0' # x-release-please-version
  purpose: Wrap an existing Rspack configuration for Zephyr publication after its Module Federation plugins are in place, keeping one publication per logical build.
  domain: xpack
  type: core
sources:
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-rspack-plugin/src/index.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-rspack-plugin/src/types/index.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-rspack-plugin/src/rspack-plugin/with-zephyr.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-rspack-plugin/src/rspack-plugin/ze-rspack-plugin.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-rspack-plugin/src/rspack-plugin/with-zephyr.spec.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-rspack-plugin/src/rspack-plugin/ze-rspack-plugin.spec.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-rspack-plugin/package.json
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-rspack-plugin/README.md
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-xpack-internal/src/hooks/ze-setup-ze-deploy.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-xpack-internal/src/xpack-extract/multi-compiler-coordinator.ts
---

# Configure Rspack for Zephyr

## Setup

Read the application's existing Rspack config, its export shape (object, array,
or function), and installed versions before editing. Keep its entries, loaders,
HTML plugin, and output settings. If `zephyr-rspack-plugin` is missing, install
it as a development dependency only when dependency changes are authorized. The
package peers on `@rspack/core` `^1.0.0 || ^2.0.0-0`.

`withZephyr(options?)` returns an async function that takes the final config and
resolves to the same config with Zephyr's plugin appended. Export that promise:

```typescript
import type { Configuration } from '@rspack/core';
import { withZephyr } from 'zephyr-rspack-plugin';

const config: Configuration = {
  // existing entry, output, loaders, and plugins
};

export default withZephyr()(config);
```

A function config can return `withZephyr()({ ... })` the same way. The supported
options are `target` (`web`, `ios`, `android`, or `tap-app`), `wait_for_index_html`,
`hooks.onDeployComplete`, and, for config arrays only, `snapshotType` and
`entrypoint`. Options prefixed with `__` are reserved for framework adapters.
Rsbuild and Modern.js apps should use their dedicated Zephyr plugins, which
call this package internally.

## Configure Module Federation

Keep the application's existing federation plugin. Add it to `plugins` before
the config reaches `withZephyr()`; Zephyr reads federation plugins from
`config.plugins` when the wrapper runs:

```typescript
import { ModuleFederationPlugin } from '@module-federation/enhanced/rspack';
import type { Configuration } from '@rspack/core';
import { withZephyr } from 'zephyr-rspack-plugin';

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

In Nx `composePlugins(...)`, put `withZephyr()` after `withModuleFederation(...)`.
Zephyr resolves remotes declared in the plugin together with the package's
`zephyr:dependencies`, then rewrites matched remotes. An unresolved remote is
logged as a warning and keeps its declared URL. The `zephyr-module-federation`
guide shipped beside this skill covers dependency declarations and build order.

## Choose the publication shape

A single config publishes its own snapshot. An exported array is wrapped once
and coordinated as one logical build: one engine, one snapshot after every
compiler succeeds. For arrays, SSR layouts, `ZE_PUBLIC_*` rewrites,
`wait_for_index_html`, base paths, and failure semantics, read
[compiler arrays and publication](references/compiler-arrays.md).

## Avoid misleading fixes

- Do not add federation plugins after wrapping, for example in a later
  `composePlugins` step. Zephyr will not see their remotes or exposes.
- Do not wrap each element of a config array separately, and do not also add
  `new ZeRspackPlugin(...)` by hand. Both produce duplicate or split publications.
- Do not copy the README's `target: 'tap-app'` example into an ordinary web app.
  That target skips remote rewrites and `ZE_PUBLIC_*` handling for SDK-locked output.
- Do not rely on the README's "Rspack 0.3 or higher". The package's peer range is
  `@rspack/core` `^1.0.0 || ^2.0.0-0`.
- Do not treat a finished Rspack build as a deployment. Single-config
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
