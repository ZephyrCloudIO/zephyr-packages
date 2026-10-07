---
name: zephyr-rolldown
description: Configure and deploy Rolldown applications with zephyr-rolldown-plugin;
  use when adding withZephyr to a Rolldown config, choosing output.dir, supplying
  TAP Module Federation metadata, or diagnosing when a Rolldown build publishes
  to Zephyr and which paths it uploads.
metadata:
  library: zephyr-rolldown-plugin
  library_version: '1.6.1' # x-release-please-version
  purpose: Add Zephyr publication to an existing Rolldown build while keeping the uploaded snapshot paths consistent with how the app references its own files.
  domain: rollup
  type: core
sources:
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-rolldown-plugin/src/index.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-rolldown-plugin/src/lib/zephyr-rolldown-plugin.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-rolldown-plugin/src/lib/zephyr-rolldown-plugin.spec.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-rolldown-plugin/src/lib/internal/get-assets-map.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-rolldown-plugin/package.json
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-rolldown-plugin/README.md
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-agent/src/lib/transformers/ze-basehref-handler.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-agent/src/lib/errors/handle-global-error.ts
---

# Configure Rolldown for Zephyr

## Setup

Read the application's existing Rolldown config, its `output` options, and the
installed package versions before editing. Keep its inputs, outputs, and
plugins. The package declares a `rolldown` peer range of `>=1.0.0-beta.0`, and
its README still labels the plugin as work in progress. If
`zephyr-rolldown-plugin` is missing, install it as a development dependency
only when dependency changes are authorized.

The package has one runtime export, the named `withZephyr`. It returns a single
plugin object, so add the call result to the existing plugin list:

```typescript
import { defineConfig } from 'rolldown';
import { withZephyr } from 'zephyr-rolldown-plugin';

export default defineConfig({
  input: 'src/main.tsx',
  plugins: [withZephyr()],
});
```

All options are optional: `target` (`'web'`, `'ios'`, `'android'`, or
`'tap-app'`), `hooks.onDeployComplete`, `mfConfigs`, and `federation`. An
unsupported `target` throws when `withZephyr()` is called. The application
identity comes from the nearest `package.json` above the first `input` entry.

## Output directory and snapshot paths

For every target except `tap-app`, the plugin uses the configured `output.dir`
as a path prefix inside the snapshot. With `dir: 'dist'`, every uploaded file is
published under `dist/` except files whose names end in `index.html`, which stay
at the root. Without an explicit `dir`, no prefix is added, even though Rolldown
still writes to `dist`. The bundled example config omits `dir`.

Read [snapshot paths](references/snapshot-paths.md) before you add, change, or
remove `output.dir`, or when a published page loads its HTML but its scripts
return 404.

## Module Federation metadata

This plugin does not install a federation runtime, read containers from the
Rolldown config, or resolve `zephyr:dependencies` into remote URLs. `mfConfigs`
and `federation` only describe containers that the build already emits. For
`tap-app` they are required and strictly validated, and the output-directory
prefix is never applied. Read [snapshot paths](references/snapshot-paths.md)
for the TAP rules. The shared `zephyr-module-federation` guide covers the
cross-project host and remote model.

## Publication lifecycle

- Zephyr initialization (package, git, and authentication) starts in the first
  `buildStart` and is reused afterwards.
- Publication happens in `writeBundle`. Each written output starts its own
  Zephyr build and uploads that output's in-memory bundle. `generate()` never
  publishes, and two written outputs publish twice.
- Emit HTML and static files through `this.emitFile`, as the README example
  does for `index.html`. Files that another plugin writes straight to disk are
  not uploaded.
- A build error marks the active Zephyr build as failed. A failed upload is
  rolled back so that a later write can retry.
- Zephyr errors are logged, and the build still exits successfully, unless
  `ZE_FAIL_BUILD=true` is set.

## Avoid misleading fixes

- Do not spread `withZephyr()`. It returns one plugin object, not an array.
- Do not add `output.dir` as a cosmetic change. It changes the published paths
  of every non-`index.html` file.
- Do not expect `zephyr:dependencies` to rewrite remote URLs in a Rolldown
  build. This plugin has no remote-resolution step.
- Do not invent TAP metadata to satisfy validation.
- Do not put credentials in `ZE_PUBLIC_*`; those values are client-visible.

## Verify completion

Run the authorized build with the application's existing script, for example
`rolldown --config ./rolldown.config.mjs`. Confirm that the expected files were
emitted and that Zephyr reported a successful publication with a version URL.
When `output.dir` is set, also confirm that the published page resolves its
scripts. A build without credentials can show that the local assets are correct,
but it cannot show that a live deployment succeeded. Report that distinction.

On failure, keep the actionable Zephyr error and fix the matching configuration
or authentication issue. Do not remove the plugin, suppress errors, or claim
that a build was deployed when its publication failed.
