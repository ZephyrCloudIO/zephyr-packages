---
name: zephyr-vinext
description: Configure and deploy Vinext applications with
  vite-plugin-vinext-zephyr; use when adding withZephyr to a Vinext Vite config,
  resolving the Worker server entrypoint, wiring deployment hooks, publishing a
  TAP package, or diagnosing why a Vinext build did not publish. Use it instead
  of the generic vite-plugin-zephyr.
metadata:
  library: vite-plugin-vinext-zephyr
  library_version: '1.6.1' # x-release-please-version
  purpose: Publish a Vinext application's finalized RSC, SSR, and client output to Zephyr as one Worker-compatible snapshot after the framework build completes.
  domain: vite
  type: core
sources:
  - ZephyrCloudIO/zephyr-packages:**/libs/vite-plugin-vinext-zephyr/src/index.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/vite-plugin-vinext-zephyr/src/lib/vite-plugin-vinext-zephyr.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/vite-plugin-vinext-zephyr/src/lib/internal/vinext-output.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/vite-plugin-vinext-zephyr/src/lib/vite-plugin-vinext-zephyr.spec.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/vite-plugin-vinext-zephyr/src/lib/internal/vinext-output.spec.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/vite-plugin-vinext-zephyr/package.json
  - ZephyrCloudIO/zephyr-packages:**/libs/vite-plugin-vinext-zephyr/README.md
---

# Configure Vinext for Zephyr

## Setup

Read the application's existing Vite config and installed `vite` and `vinext`
versions before editing. Keep `vinext()` and the Cloudflare plugin
configuration. If `vite-plugin-vinext-zephyr` is missing, install it as a
development dependency only when dependency changes are authorized.

The package declares a Vite 7 or 8 peer and no `vinext` peer range; it was
built against the Vinext beta pinned in the workspace, so check the app's
installed Vinext before assuming newer output layouts. Add the plugin after
`vinext()` and the Cloudflare plugin:

```typescript
import { defineConfig } from 'vite';
import vinext from 'vinext';
import { cloudflare } from '@cloudflare/vite-plugin';
import { withZephyr } from 'vite-plugin-vinext-zephyr';

export default defineConfig({
  plugins: [
    vinext(),
    cloudflare({
      viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] },
    }),
    withZephyr(),
  ],
});
```

`withZephyr`, `withZephyrVinext`, and the default export are the same
function. It returns one plugin object, so add it directly rather than
spreading it. The plugin applies only to builds (`apply: 'build'`) and is
`enforce: 'post'` with a post-ordered `buildApp` hook.

Use this package instead of `vite-plugin-zephyr`. Do not add the generic plugin
alongside it; both would try to publish the same application.

## Module Federation

This integration does not install federation plugins and does not resolve
`zephyr:dependencies` into remote URLs. `mfConfigs` and `federation` are
publication metadata forwarded unchanged and are required only for TAP
packages. Read [output and TAP packages](references/output-and-tap.md) before
setting them. The shared `zephyr-module-federation` guide covers the
cross-project host and remote model.

## Publication lifecycle and runtime target

Run the application's normal `vite build`. Vinext finalizes its RSC assets
manifest in its own `buildApp` work; Zephyr publishes afterwards, once every
Vite environment reports that it is built. If any environment is incomplete
the plugin throws rather than publishing a partial RSC/SSR deployment. A build
path that skips Vite's `buildApp` phase publishes nothing.

The plugin uploads the whole output root (`dist/` under the Vite root unless
`outputDir` is set), adds the RSC assets manifest module to the `rsc` and `ssr`
outputs when the RSC plugin exposes it, and strips unused `node:fs` and
`node:path` side-effect imports from server JavaScript in the uploaded copy.
Ordinary deployments are SSR snapshots for Zephyr's Cloudflare-based edge
runtime; the server entry is auto-detected. Read [output and TAP packages](references/output-and-tap.md)
when detection fails or the snapshot type must change.

Pass `hooks: { onDeployComplete(info) { ... } }` to observe a completed
deployment; `ZephyrBuildHooks` and `DeploymentInfo` types are re-exported.

## Avoid misleading fixes

- Do not remove the Cloudflare plugin to get past an upload error. The
  published server bundle runs as a Worker, and Pages Router entry detection
  relies on the emitted Wrangler config.
- Do not set `entrypoint` to a source file. It must be an emitted file inside
  the output root; paths containing `..` are rejected.
- Do not add `target: 'tap-app'` to an ordinary web app. TAP switches the
  default snapshot to CSR, skips the manifest and import rewriting, and
  requires paired federation metadata.
- Do not treat a successful Vite build as publication. Upload errors are logged
  and the build continues unless `ZE_FAIL_BUILD=true` is set; only option
  validation and incomplete environments always fail the build.
- Do not put credentials in `ZE_PUBLIC_*`; those values are client-visible.

## Verify completion

Run the authorized build with the application's existing package runner.
Confirm the output root contains the client assets and a server entry, and
that the build prints `Deployed to Zephyr's edge in ...ms.` followed by a
version URL. The plugin's `Uploading Vinext build (... snapshotType: ssr)` line
appears only with `DEBUG=zephyr:upload`; use it to confirm the snapshot type
and output root when diagnosing. A build without credentials can
establish local output correctness, but not live deployment success. Report
that distinction.

On failure, keep the actionable error, such as `Could not infer Vinext
entrypoint`, and fix the matching configuration. Do not silently switch to
CSR, drop the Worker build, or claim a partial build was deployed.
