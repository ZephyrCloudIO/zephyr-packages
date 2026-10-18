# Configure Rsbuild for Zephyr

## Setup

Read the application's existing Rsbuild config and installed package versions
before editing. Keep its framework plugins, environments, and output settings.
If `zephyr-rsbuild-plugin` is missing, install it as a development dependency
only when dependency changes are authorized. It peers on `@rsbuild/core`
`^1.0.0 || ^2.0.0-0` and brings `zephyr-rspack-plugin` as its own dependency.

Add `withZephyr()` to the existing plugin list:

```typescript
import { defineConfig } from '@rsbuild/core';
import { withZephyr } from 'zephyr-rsbuild-plugin';

export default defineConfig({
  plugins: [withZephyr()],
});
```

In a real config, keep plugins such as `pluginReact()` and add `withZephyr()`
beside them. The options are `target` (`web`, `ios`, `android`, or `tap-app`),
`wait_for_index_html`, `hooks.onDeployComplete`, `snapshotType`, and
`entrypoint`. The options type is not exported from the package entry; use
`Parameters<typeof withZephyr>[0]` when a named type is needed.

## Configure Module Federation

Keep `@module-federation/rsbuild-plugin` for the container and add Zephyr to the
same plugin list:

```typescript
import { pluginModuleFederation } from '@module-federation/rsbuild-plugin';
import { defineConfig } from '@rsbuild/core';
import { withZephyr } from 'zephyr-rsbuild-plugin';

export default defineConfig({
  plugins: [
    pluginModuleFederation({
      name: 'catalog',
      exposes: { './Product': './src/Product.tsx' },
    }),
    withZephyr(),
  ],
});
```

The federation plugin adds its Rspack plugins in `onBeforeCreateCompiler`.
Zephyr registers a post-ordered handler for the same hook, so it reads those
plugins and resolves remotes after they exist. Placing Zephyr after the
federation plugin keeps the config readable; the hook order is what matters.

Zephyr resolves declared remotes together with the package's
`zephyr:dependencies`. The `zephyr-module-federation` skill
covers dependency declarations and host/remote build order.

## Choose the publication shape

Every Rsbuild environment becomes one compiler config, and all of them are
coordinated into a single snapshot published after every compiler succeeds.
Node-target environments make the snapshot SSR. For SSR entrypoints, the
`ZE_PUBLIC_*` import map, base paths, and failure semantics, read
[environments and publication](rsbuild-environments.md).

## Avoid misleading fixes

- Do not also wrap `tools.rspack` with `zephyr-rspack-plugin`'s `withZephyr`.
  This plugin already applies it to every environment; doing both adds a second
  Zephyr plugin and an independent publication to each compiler.
- Do not set `snapshotType: 'ssr'` without a server environment that emits the
  `entrypoint`. Publication fails when the entrypoint is not emitted.
- Do not copy the README's `target: 'tap-app'` options example into an ordinary
  web app. That target is for SDK-locked mini-app output.
- Do not treat a finished Rsbuild build as a deployment. Check Zephyr's
  publication output and version URL separately.
- Do not put credentials in `ZE_PUBLIC_*`; those values are client-visible.

## Verify completion

Run the authorized production build with the application's existing package
runner. Confirm the expected assets are emitted and Zephyr reports a successful
publication with a version URL. A compilation with errors is never uploaded.
Without working Zephyr credentials the coordinated build can stop at
configuration or publication; at most it establishes local asset correctness,
not live deployment success. Report that distinction.

On failure, keep the actionable error and fix the matching configuration or
publication issue. Do not silently remove environments or federation plugins,
suppress errors, or claim that a partial build was deployed.
