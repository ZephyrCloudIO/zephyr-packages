---
name: zephyr-metro
description: Configure and deploy React Native Metro applications with
  zephyr-metro-plugin; use when adding withZephyr to metro.config.js,
  registering the bundle-mf-host or bundle-mf-remote publication commands for
  the React Native CLI or RNEF, or diagnosing iOS and Android Module Federation
  publication with @module-federation/metro.
metadata:
  library: zephyr-metro-plugin
  library_version: '1.6.0' # x-release-please-version
  purpose: Publish iOS and Android Metro Module Federation bundles to Zephyr by pairing the configuration-only withZephyr wrapper with the command integration that actually uploads.
  domain: native
  type: core
sources:
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-metro-plugin/src/index.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-metro-plugin/src/lib/with-zephyr.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-metro-plugin/src/lib/zephyr-metro-react-native-cli.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-metro-plugin/src/lib/zephyr-metro-rnef-plugin.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-metro-plugin/src/lib/zephyr-metro-command-wrapper.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-metro-plugin/src/lib/zephyr-metro-plugin.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-metro-plugin/src/lib/internal/mutate-mf-config.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-metro-plugin/src/lib/__test__/with-zephyr.integration.spec.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-metro-plugin/src/lib/__test__/zephyr-metro-command-wrapper.spec.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-metro-plugin/src/lib/__test__/zephyr-metro-react-native-cli.spec.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-metro-plugin/README.md
---

# Configure Metro for Zephyr

## Setup

Read the app's existing `metro.config.js`, `react-native.config.js` or
`rnef.config.mjs`, and installed React Native, Metro, and
`@module-federation/metro` versions before editing. Keep the existing Metro and
federation configuration. Install `zephyr-metro-plugin` as a development
dependency only when dependency changes are authorized.

The integration has two separate parts:

- `withZephyr()` is configuration-only. It resolves the remotes passed to it,
  writes `assets/zephyr-manifest.json`, and serves that manifest from the Metro
  dev server. It never uploads artifacts.
- The `bundle-mf-host` and `bundle-mf-remote` commands publish. They wrap the
  commands from `@module-federation/metro`, which is loaded from the app's own
  dependencies and is not a declared peer of this package.

Wrap the Module Federation Metro config, then register the commands:

```javascript
// metro.config.js
const { getDefaultConfig } = require('@react-native/metro-config');
const { withModuleFederation } = require('@module-federation/metro');
const { withZephyr } = require('zephyr-metro-plugin');

const config = withModuleFederation(getDefaultConfig(__dirname), {
  name: 'MobileCart',
  exposes: { './Cart': './src/Cart.tsx' },
});

module.exports = withZephyr()(config);
```

```javascript
// react-native.config.js
const { zephyrMetroReactNativeCli } = require('zephyr-metro-plugin');

module.exports = {
  commands: [...zephyrMetroReactNativeCli().commands],
};
```

For RNEF, add `zephyrMetroRNEFPlugin()` to the existing `plugins` array of
`rnef.config.mjs` instead. Merge rather than replace existing entries.

The package declares peers `metro >=0.70.0` and `react-native >=0.60.0`. The
commands are stricter: `@module-federation/metro@2.9.0` declares Metro packages
`^0.82.1`, `react-native >=0.79.0`, and `@babel/types ^7.25.0`. Upgrade only
when authorized.

## Configure Module Federation and platforms

Keep the federation container in `withModuleFederation(...)`. The commands read
it from the global that `withModuleFederation` sets while Metro config loads. A
missing config fails with a misleading message: `ZE00000: Unknown error:
Library name {{library_name}} must be a valid identifier...`. When that
template text appears with the placeholder unfilled, check that
`metro.config.js` wraps its config in `withModuleFederation` rather than
renaming the container. Before
bundling, Zephyr resolves `zephyr:dependencies` and federation `remotes`, then
rewrites each resolved remote to the plain `name@url` form that Metro accepts,
preferring the remote's manifest URL.
Use the `zephyr-module-federation` guide for host/remote wiring and build order.

Metro publishes native bundles only. Every entry point accepts `ios` or
`android` and rejects any other value, including `tap-app`, before Zephyr
creates a build. The publication platform comes from the command's
`--platform`; publish each platform with its own command run:

```bash
npx react-native bundle-mf-remote --platform ios
npx react-native bundle-mf-remote --platform android
```

`withZephyr({ target })` accepts the same two values. Its `remotes` option only
feeds the runtime manifest; it is separate from the federation `remotes`.

## Publication lifecycle

After the wrapped bundle command finishes, Zephyr uploads every file under
`<project root>/dist/<platform>`, the default output of the upstream remote
command. A missing directory publishes no bundle files, which the source treats
as normal for host bundles written elsewhere, such as by the Xcode bundling
phase. For custom output paths, RNEF details, or a hand-written command
wrapper, read [publication commands](references/publication-commands.md).

## Avoid misleading fixes

- Do not expect `withZephyr()` alone to deploy. Its success log states that no
  artifacts were uploaded; register a publication command.
- Do not pass `--output` to move a remote bundle out of `dist`. Zephyr still
  reads `dist/<platform>` and can miss the new output or upload stale files.
- Do not hard-code `target` from an environment variable without checking it is
  `ios` or `android`; other values throw.
- Do not set `global.__METRO_FEDERATION_CONFIG` by hand to silence the missing
  config error. Fix the `withModuleFederation` wrapping in `metro.config.js`.
- Do not put credentials in `ZE_PUBLIC_*`; those values are client-visible.

## Verify completion

Run the authorized publication command for each required platform with the
app's package runner. Confirm the bundle exists under `dist/<platform>` and
that the command printed `Bundle artifacts uploaded to Zephyr.` followed by
`Success.`, which appear only after publication resolves. A Metro dev server or
`react-native bundle` run shows configuration success, not deployment. Report
that distinction.

On failure, keep the actionable `ZephyrError` and fix the matching config,
platform, or credential issue. Do not suppress errors or claim that a build
for one platform deployed the other.
