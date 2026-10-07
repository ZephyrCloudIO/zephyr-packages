---
name: zephyr-rollup
description: Configure and deploy Rollup applications with rollup-plugin-zephyr; use
  when adding withZephyr to a Rollup config, supplying TAP Module Federation
  metadata, or diagnosing when a Rollup build publishes to Zephyr and which
  files it uploads.
metadata:
  library: rollup-plugin-zephyr
  library_version: '1.6.0' # x-release-please-version
  purpose: Add Zephyr publication to an existing Rollup 4 build so each written output bundle is uploaded as a Zephyr version without changing how Rollup bundles it.
  domain: rollup
  type: core
sources:
  - ZephyrCloudIO/zephyr-packages:**/libs/rollup-plugin-zephyr/src/index.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/rollup-plugin-zephyr/src/lib/rollup-plugin-zephyr.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/rollup-plugin-zephyr/src/lib/rollup-plugin-zephyr.spec.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/rollup-plugin-zephyr/src/lib/transform/get-assets-map.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/rollup-plugin-zephyr/package.json
  - ZephyrCloudIO/zephyr-packages:**/libs/rollup-plugin-zephyr/README.md
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-agent/src/lib/errors/handle-global-error.ts
---

# Configure Rollup for Zephyr

## Setup

Read the application's existing Rollup config, its `output` entries, and the
installed package versions before editing. Keep its inputs, outputs, and
plugins. The package declares a `rollup` peer range of `^4.0.0`. If
`rollup-plugin-zephyr` is missing, install it as a development dependency only
when dependency changes are authorized.

The package has one runtime export, the named `withZephyr`. It returns a single
Rollup plugin object, so add the call result to the existing plugin list:

```typescript
import { defineConfig } from 'rollup';
import { withZephyr } from 'rollup-plugin-zephyr';

export default defineConfig({
  input: 'src/main.js',
  output: { dir: 'dist', format: 'es' },
  plugins: [withZephyr()],
});
```

CommonJS configs use `const { withZephyr } = require('rollup-plugin-zephyr')`.
All options are optional: `target` (`'web'`, `'ios'`, `'android'`, or
`'tap-app'`), `hooks.onDeployComplete`, `mfConfigs`, and `federation`. An
unsupported `target` throws when `withZephyr()` is called.

The application identity comes from the nearest `package.json` above the first
`input` entry, which is the string, the first array item, or the first object
value. Keep that entry inside the application package so the build is not
published under a parent workspace's name.

## Module Federation metadata

This plugin does not install a federation runtime, read containers from the
Rollup config, or resolve `zephyr:dependencies` into remote URLs. Keep the
federation tooling the build already uses. `mfConfigs` and `federation` only
describe containers that the build already emits. For `target: 'tap-app'` they
are required and strictly validated. Read [TAP metadata](references/tap-metadata.md)
before setting either option. The shared `zephyr-module-federation` guide covers
the cross-project host and remote model.

## Publication lifecycle

- `buildStart` begins Zephyr initialization (package, git, and authentication)
  once per plugin instance.
- Publication happens in `writeBundle`. Each written output starts its own
  Zephyr build and uploads that output's in-memory bundle. `bundle.generate()`
  never publishes, and a config with two `output` entries publishes twice.
- Uploaded files are the bundle's chunks and emitted assets. Emit HTML and
  static files through `this.emitFile` so they are part of the bundle. Files
  that another plugin copies straight to disk are not uploaded.
- A Rollup build error marks the active Zephyr build as failed. A failed upload
  is rolled back so that a later write can retry.
- Watch mode reuses the plugin instance and publishes again after each rebuild
  is written.
- Zephyr errors are logged, and the Rollup command still exits successfully,
  unless `ZE_FAIL_BUILD=true` is set. That setting rethrows them and fails the build.

## Avoid misleading fixes

- Do not import `zephyrPlugin`. The package README shows that name, but the
  package exports only `withZephyr`.
- Do not spread `withZephyr()` into `plugins`. It returns one plugin object,
  not an array.
- Do not add extra `output` entries to "try" Zephyr. Every written output is a
  separate publication.
- Do not expect `zephyr:dependencies` to rewrite remote URLs in a Rollup build.
  This plugin has no remote-resolution step.
- Do not invent TAP metadata to satisfy validation. Supply the records the TAP
  SDK produced for the containers that were actually built.
- Do not put credentials in `ZE_PUBLIC_*`; those values are client-visible.

## Verify completion

Run the authorized build with the application's existing script, for example
`rollup -c`. Confirm that the expected output files were emitted and that Zephyr
reported a successful publication with a version URL, or that
`hooks.onDeployComplete` received one. A build without credentials can show
that the local assets are correct, but it cannot show that a live deployment
succeeded. Report that distinction, especially when Zephyr errors were only
logged.

On failure, keep the actionable Zephyr error and fix the matching configuration
or authentication issue. Do not remove the plugin, suppress errors, or claim
that a build was deployed when its publication failed.
