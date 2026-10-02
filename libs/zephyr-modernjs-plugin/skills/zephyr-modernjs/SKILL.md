---
name: zephyr-modernjs
description: Configure and deploy Modern.js 3 applications with
  zephyr-modernjs-plugin; use when adding withZephyr to modern.config, ordering
  it with Modern.js Module Federation, checking the Rspack plugin dependency
  and output layout, or diagnosing Modern.js client/server publication.
metadata:
  library: zephyr-modernjs-plugin
  library_version: '1.4.2' # x-release-please-version
  purpose: Add Zephyr to an existing Modern.js 3 app as a CLI plugin that delegates each Rspack config to zephyr-rspack-plugin after federation config runs.
  domain: frameworks
  type: core
sources:
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-modernjs-plugin/src/index.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-modernjs-plugin/src/modernjs-plugin/with-zephyr.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-modernjs-plugin/src/modernjs-plugin/with-zephyr.spec.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-modernjs-plugin/package.json
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-modernjs-plugin/README.md
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-rspack-plugin/src/rspack-plugin/with-zephyr.ts
---

# Configure Modern.js for Zephyr

## Setup

Read the application's existing `modern.config.ts` and installed package
versions before editing. Keep `appTools()`, its runtime and router settings,
and other framework plugins. The package peers on `@modern-js/app-tools` ^3.0.0.

Install both `zephyr-modernjs-plugin` and `zephyr-rspack-plugin` as development
dependencies when dependency changes are authorized. The Rspack plugin is
declared as an optional peer, but the Modern.js plugin imports it while
configuring every build, so the build fails to configure without it.

Add `withZephyr()` after `appTools()`. The package README lists these output
settings as required so the HTML entry is emitted at the output root; the plugin
does not set them for you:

```typescript
import { appTools, defineConfig } from '@modern-js/app-tools';
import { withZephyr } from 'zephyr-modernjs-plugin';

export default defineConfig({
  output: {
    distPath: { html: './' },
  },
  html: {
    outputStructure: 'flat',
  },
  source: {
    mainEntryName: 'index',
  },
  plugins: [appTools(), withZephyr()],
});
```

The options are `target` (`web`, `ios`, `android`, or `tap-app`),
`wait_for_index_html`, and `hooks.onDeployComplete`, exported as
`ZephyrModernjsPluginOptions`. `snapshotType` and `entrypoint` are accepted but
have no effect; see the publication section below.

## Order with Module Federation

The plugin declares `pre: ['@modern-js/plugin-module-federation-config']`, so
Modern.js runs Module Federation's config plugin before Zephyr's. Zephyr then
reads federation plugins and resolves remotes in `modifyRspackConfig`. Keep the
app's existing Module Federation Modern.js plugin; do not reorder plugins to
work around federation detection.

Modern.js applies `tools.rspack` after `modifyRspackConfig`, so federation
plugins added there are invisible to Zephyr. The `zephyr-module-federation`
guide shipped beside this skill covers `zephyr:dependencies` and build order.

## Understand the publication shape

Modern.js 3 builds only with Rspack. Modern.js calls `modifyRspackConfig` once
per generated Rspack config, and this plugin wraps each config separately with
`zephyr-rspack-plugin`. Each config therefore gets its own Zephyr engine and
publication; client and server configs are not coordinated into one snapshot.
`snapshotType` and `entrypoint` only take effect for coordinated config arrays,
so they do not change Modern.js output.

When `NODE_ENV` is `development` as the config loads, a companion plugin sets
the client `output.publicPath` to `auto` for the dev server, except for
`tap-app`. Production builds keep the app's public path.

## Avoid misleading fixes

- Do not remove `zephyr-rspack-plugin` because it is an optional peer. The
  Modern.js plugin cannot configure the build without it.
- Do not follow the README's `appTools({ bundler: 'webpack' })` guidance or its
  "Modern.js 2.x" requirement. In `@modern-js/app-tools` 3.x, `appTools()`
  takes no arguments, and this plugin only hooks Rspack config.
- Do not rely on `snapshotType` or `entrypoint` to shape an SSR snapshot here,
  despite the README's claim that compilers are coordinated.
- Do not treat a finished Modern.js build as a deployment. Each per-config
  publication error is logged and the build continues unless
  `ZE_FAIL_BUILD=true` is set.
- Do not put credentials in `ZE_PUBLIC_*`; those values are client-visible.

## Verify completion

Run the authorized production build with the application's existing package
runner, usually `modern build`. Confirm the HTML entry is at the output root,
any federation remotes appear in Zephyr's "Resolved remotes" log, and each
publication Zephyr reports has a version URL. A compilation with errors is never
uploaded. A build without credentials can establish local asset correctness,
but not live deployment success. Report that distinction.

On failure, keep the actionable error and fix the matching configuration or
publication issue. Do not switch bundlers, remove federation plugins, suppress
errors, or claim that a partial build was deployed.
