---
name: zephyr-repack
description: Configure and deploy React Native Re.Pack applications with
  zephyr-repack-plugin; use when wrapping a Re.Pack rspack.config with
  withZephyr, publishing iOS and Android Module Federation hosts or mini-apps,
  or diagnosing why a Re.Pack build did not publish to Zephyr.
metadata:
  library: zephyr-repack-plugin
  library_version: '1.6.0' # x-release-please-version
  purpose: Wrap an existing Re.Pack configuration function so each iOS or Android bundle build resolves its Zephyr remotes and publishes its own platform snapshot.
  domain: native
  type: core
sources:
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-repack-plugin/src/index.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-repack-plugin/src/lib/with-zephyr.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-repack-plugin/src/lib/ze-repack-plugin.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-repack-plugin/src/lib/native-target.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-repack-plugin/src/lib/utils/ze-util-verification.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-repack-plugin/src/type/zephyr-internal-types.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-repack-plugin/src/lib/with-zephyr.spec.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-repack-plugin/src/lib/ze-repack-plugin.spec.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-xpack-internal/src/xpack-extract/mut-webpack-federated-remotes-config.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-xpack-internal/src/hooks/ze-setup-ze-deploy.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-repack-plugin/README.md
---

# Configure Re.Pack for Zephyr

## Setup

Read the app's existing `rspack.config.*` and installed Re.Pack, Rspack, and
React Native versions before editing. Keep its Re.Pack plugins, loaders, and
federation config. If `zephyr-repack-plugin` is missing, install it as a
development dependency only when dependency changes are authorized. The package
declares no peer dependencies, so check the app's Re.Pack setup rather than
assuming a version range.

`withZephyr(options)(configFn)` wraps a config function, not a config object.
It returns the async `(env) => configuration` function that Re.Pack calls for
each platform. Wrap the function the file already exports:

```javascript
// rspack.config.mjs
import * as Repack from '@callstack/repack';
import { withZephyr } from 'zephyr-repack-plugin';

const dirname = Repack.getDirname(import.meta.url);

export default withZephyr()(({ mode, platform }) => ({
  mode,
  context: dirname,
  // keep the existing entry, resolve, and module rules
  plugins: [
    new Repack.RepackPlugin(),
    new Repack.plugins.ModuleFederationPluginV2({
      name: 'MobileCart',
      filename: 'MobileCart.container.js.bundle',
      exposes: { './Cart': './src/Cart.tsx' },
    }),
  ],
}));
```

The wrapper calls your function with only `platform` and `mode`. Other Re.Pack
env fields such as `context`, `reactNativePath`, or `devServer` are not
forwarded, so derive `context` from the config file location as above. The
returned configuration must contain a `plugins` array; Zephyr appends its
deployment plugin to it.

## Configure Module Federation and platforms

Keep the existing `ModuleFederationPluginV2` (or another plugin whose name
contains `ModuleFederationPlugin`). Zephyr reads `zephyr:dependencies` and the
plugin's `remotes`, resolves them for the platform being built, and rewrites
each resolved remote to a plain `name@url` string. Re.Pack remotes do not get
the browser runtime-loader code used by web bundlers. Use the
`zephyr-module-federation` guide for host/remote wiring and build order.

A host keeps its local remote declarations; Zephyr replaces those it resolves:

```javascript
new Repack.plugins.ModuleFederationPluginV2({
  name: 'MobileHost',
  remotes: {
    MobileCart: `MobileCart@http://localhost:9000/${platform}/MobileCart.container.js.bundle`,
  },
});
```

The build target is `ios` or `android`. By default it is Re.Pack's `platform`,
so each platform build resolves and publishes separately. Any other platform
or `target`, including `tap-app`, throws before your config function runs or a
Zephyr build starts. With a `var` or unset library type, the container `name`
must be a valid JavaScript identifier, such as `MobileCart`, not `mobile-cart`.

## Publication lifecycle

Zephyr uploads from each compilation's final asset-processing stage, using the
assets Re.Pack produced for that platform. A compilation with errors is not
uploaded. The optional `hooks.onDeployComplete` callback receives
the deployment URL after upload; a failing hook is logged and does not fail
the build. The deployment plugin does not skip development compilations, so
publish through the app's existing production bundle command for each platform.

## Avoid misleading fixes

- Do not pass a config object to the inner call. `withZephyr()(config)` with an
  object fails when Re.Pack invokes it; wrap a function.
- Do not hard-code `target: 'ios'` in a config shared by both platforms. An
  explicit `target` overrides `platform`, so the Android build would resolve
  and publish as iOS.
- Do not treat a successful bundle as publication. Errors while Zephyr
  configures the build, such as a failed remote resolution or an invalid
  container name, are logged and the deployment plugin is not added, unless
  `ZE_FAIL_BUILD=true` makes them fail the build. Upload errors are likewise
  logged rather than thrown by default.
- Do not put credentials in `ZE_PUBLIC_*`; those values are client-visible.

## Verify completion

Run the authorized bundle command for each required platform with the app's
package runner. Confirm the platform bundle and container files are emitted and
Zephyr reports a successful upload with a version URL for that platform. A
build without credentials can show local bundle correctness, not deployment.
Report that distinction, per platform.

On failure, keep the actionable Zephyr error and fix the matching config,
platform, or credential issue. Do not suppress errors or claim that one
platform's publication covers the other.
