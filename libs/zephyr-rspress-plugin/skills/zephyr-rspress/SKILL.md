---
name: zephyr-rspress
description: Configure and deploy Rspress documentation sites with
  zephyr-rspress-plugin; use when adding withZephyr to rspress.config, choosing
  between SSG and non-SSG publication, or diagnosing files missing from an
  Rspress upload, including output from other plugins' afterBuild hooks and
  Module Federation SSG builds.
metadata:
  library: zephyr-rspress-plugin
  library_version: '1.4.2' # x-release-please-version
  purpose: Add Zephyr publication to an existing Rspress site and pick the SSG or Rsbuild publication path so every emitted and post-build file is uploaded.
  domain: frameworks
  type: core
sources:
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-rspress-plugin/src/index.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-rspress-plugin/src/with-zephyr.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-rspress-plugin/src/zephyrRspressSSGPlugin.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-rspress-plugin/src/internal/lifecycle/afterBuildHooks.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-rspress-plugin/src/internal/assets/moduleFederationPublicPathPlugin.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-rspress-plugin/src/internal/assets/rewriteRspressModuleFederationAssets.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-rspress-plugin/src/__test__/with-zephyr.spec.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-rspress-plugin/src/__test__/zephyrRspressSSGPlugin.spec.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-rspress-plugin/src/__test__/afterBuildHooks.spec.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-rspress-plugin/README.md
---

# Configure Rspress for Zephyr

## Setup

Read the site's existing `rspress.config.*` and installed Rspress version
before editing. Keep its plugins, `root`, `outDir`, and `builderConfig`. If
`zephyr-rspress-plugin` is missing, install it as a development dependency only
when dependency changes are authorized. The package declares the peer
`@rspress/core ^2.0.0`; its source still accepts the Rspress 1 `builderPlugins`
config shape.

Add `withZephyr()` to the Rspress `plugins` list, not to Rsbuild plugins, and
set `ssg` explicitly:

```typescript
import { defineConfig } from '@rspress/core';
import { withZephyr } from 'zephyr-rspress-plugin';

export default defineConfig({
  ssg: true,
  plugins: [withZephyr()],
});
```

Options are `target` (`web`, `ios`, `android`, or `tap-app`; other values
throw) and `hooks.onDeployComplete`. Omit `target` for an ordinary site.

## Choose the publication path

`withZephyr()` picks its path from the `ssg` value its config hook receives:

- `ssg: true` or an options object publishes after `rspress build` finishes.
  Zephyr waits for other plugins' `afterBuild` hooks, then uploads every file
  under `outDir` (default `doc_build`), including HTML rendered by SSG.
- `ssg: false` adds the `zephyr-rsbuild-plugin` publication to the Rsbuild
  plugins. It uploads the Rsbuild output during bundling, before any Rspress
  `afterBuild` hook runs.

Rspress 2 turns an unset `ssg` into `true` before plugin config hooks run.
Rspress 1 does not, so Zephyr takes the non-SSG path there even though
Rspress still renders SSG pages afterward. Setting `ssg` explicitly avoids
that mismatch.

For post-build plugin ordering, Module Federation in SSG builds, or files that
change on disk before upload, read
[SSG publication](references/ssg-publication.md).

## Avoid misleading fixes

- Do not move Zephyr to the end of `plugins` to capture another plugin's
  generated files. Rspress runs `afterBuild` hooks in parallel; Zephyr already
  waits for hooks of plugins listed in `config.plugins`. Plugins added only
  through Rspress's `addPlugin` utility are not tracked.
- Do not switch to `ssg: false` to simplify publication. That path uploads
  before `afterBuild` hooks and omits files they generate.
- Do not also add the Rsbuild `withZephyr()` to `builderConfig.plugins`.
  The Rspress plugin selects and installs the publication path itself.
- Do not assume a quiet build published. When the SSG path finds nothing under
  `outDir`, resolved from the working directory, it publishes nothing and
  prints nothing by default; with `DEBUG=zephyr:upload` it logs
  `No files found in output directory.`. Check `outDir` and where the build
  runs.
- Do not put credentials in `ZE_PUBLIC_*`; those values are client-visible.

## Verify completion

Run the authorized `rspress build` through the site's package runner. Confirm
the expected HTML and assets are in `outDir`, including files from post-build
plugins, and that the build prints `Deployed to Zephyr's edge in ...ms.`
followed by a version URL. A
build without credentials can establish local output correctness, not live
deployment. Report that distinction.

Zephyr errors in this plugin are logged rather than thrown unless
`ZE_FAIL_BUILD=true`, so a finished build alone is not proof of publication.
On failure, keep the actionable error and fix the matching configuration. Do
not suppress errors or claim that a partial upload was deployed.
