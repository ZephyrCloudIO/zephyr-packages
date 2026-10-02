---
name: zephyr-nuxt
description: Configure and deploy Nuxt applications with zephyr-nuxt-module; use
  when adding the module to nuxt.config, setting zephyr options, choosing
  between SSR and static (CSR) snapshots, selecting the Nitro preset, publishing
  a TAP package, or diagnosing why nuxt build did not publish.
metadata:
  library: zephyr-nuxt-module
  library_version: '1.4.2' # x-release-please-version
  purpose: Publish a Nuxt application's Nitro build output to Zephyr after nuxt build, choosing an SSR or static snapshot from what Nitro actually emitted.
  domain: frameworks
  type: core
sources:
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-nuxt-module/src/index.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-nuxt-module/src/lib/nuxt-module.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-nuxt-module/src/lib/ssr-upload.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-nuxt-module/src/lib/paths.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-nuxt-module/src/lib/runtime-guards.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-nuxt-module/src/lib/types.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-nuxt-module/src/lib/ssr-upload.spec.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-nuxt-module/package.json
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-nuxt-module/README.md
---

# Configure Nuxt for Zephyr

## Setup

Read the application's existing `nuxt.config.*`, its `nitro` settings and
preset, and the installed `nuxt` version before editing. Keep its modules and
Nitro configuration. If `zephyr-nuxt-module` is missing, install it as a
development dependency only when dependency changes are authorized.

The installed package declares `nuxt` and `@nuxt/kit` peers of `^3.0.0 ||
^4.0.0`. Add the module by name; options go under the `zephyr` config key and
are all optional:

```typescript
export default defineNuxtConfig({
  nitro: {
    preset: 'cloudflare_module',
  },
  modules: ['zephyr-nuxt-module'],
});
```

The example shows the Cloudflare Worker preset that Zephyr's SSR runtime
expects; if the app uses another preset, changing it is a deployment-target change that needs
authorization. The package's default export (also `zephyrNuxtModule`) is the
module, and `ZephyrNuxtOptions` types the `zephyr` key. Do not add
`vite-plugin-zephyr` to `vite.plugins` as well; the module owns publication.

## Module Federation

This module does not configure Module Federation and does not resolve
`zephyr:dependencies` into remote URLs. Its `mfConfigs` and `federation`
options are publication metadata forwarded unchanged and are required only for
TAP packages. Read [output and snapshots](references/output-and-snapshots.md)
before setting them. The shared `zephyr-module-federation` guide covers the
cross-project host and remote model.

## Publication lifecycle and runtime target

The module does nothing in `nuxt dev`, `nuxi prepare`, or a `postinstall`
script. During `nuxt build` it uploads from Nuxt's `close` hook, after Nitro
has written its output.

It reads `.output` under the project root unless `nitro.output.dir` or
`zephyr.outputDir` says otherwise. When `server/index.mjs`, `server/index.js`,
or `server/index.cjs` exists there, it publishes an SSR snapshot with that
entry; otherwise it publishes a static CSR snapshot. SSR snapshots run in
Zephyr's Cloudflare-based edge runtime and the module does not check the
preset, so keep a Worker preset such as `cloudflare_module` rather than the
default Node server. Read [output and snapshots](references/output-and-snapshots.md)
for static sites, custom output paths, or `app.baseURL`.

## Avoid misleading fixes

- Do not force `snapshotType: 'ssr'` without an emitted server entry. The module
  then skips publication without failing the build, even with
  `ZE_FAIL_BUILD=true`, and prints nothing unless `DEBUG=zephyr:upload` is set.
  With it set, the skip logs `SSR snapshot requested but no entrypoint found.`
- Do not trust an explicit `entrypoint` blindly; the module normalizes it but
  never checks that the file exists. Prefer auto-detection.
- Do not set `target: 'tap-app'` on an ordinary app. TAP requires paired
  federation metadata and changes how public files are mapped.
- Do not treat a successful `nuxt build` as publication. Upload errors are
  logged and the build continues unless `ZE_FAIL_BUILD=true` is set. An empty
  output directory skips publication silently in either case.
- Do not put credentials in `ZE_PUBLIC_*`; those values are client-visible.

## Verify completion

Run the authorized build with the application's existing package runner.
Confirm the Nitro output contains the expected server entry or public files,
and that the build prints `Deployed to Zephyr's edge in ...ms.` followed by a
version URL. A missing deploy line means nothing was published, even when
`nuxt build` succeeds. To see which snapshot type and directory the module
chose, rerun with `DEBUG=zephyr:upload`; it then logs
`Zephyr upload starting. snapshotType=...` and `Zephyr upload complete.`. A
build without credentials can establish local output correctness, but not
live deployment success. Report that distinction.

On failure, keep the actionable log line and fix the matching configuration.
Do not silently change the Nitro preset, force a snapshot type, or claim a
skipped or partial upload was deployed.
