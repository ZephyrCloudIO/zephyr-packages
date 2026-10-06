---
name: zephyr-tanstack-start
description: Configure and deploy TanStack Start applications with
  vite-plugin-tanstack-start-zephyr; use when adding withZephyr to a TanStack
  Start Vite config, choosing the SSR server entrypoint or output directory,
  publishing a TAP package, or diagnosing why a TanStack Start build did not
  publish. Use it instead of the generic vite-plugin-zephyr.
metadata:
  library: vite-plugin-tanstack-start-zephyr
  library_version: '1.6.0' # x-release-please-version
  purpose: Publish a TanStack Start application's finalized client and server output to Zephyr as one SSR snapshot without taking over the framework's own Vite build.
  domain: vite
  type: core
sources:
  - ZephyrCloudIO/zephyr-packages:**/libs/vite-plugin-tanstack-start-zephyr/src/index.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/vite-plugin-tanstack-start-zephyr/src/lib/vite-plugin-tanstack-start-zephyr.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/vite-plugin-tanstack-start-zephyr/src/lib/internal/extract/load-tanstack-output.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/vite-plugin-tanstack-start-zephyr/src/lib/vite-plugin-tanstack-start-zephyr.spec.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/vite-plugin-tanstack-start-zephyr/src/lib/vite-plugin-tanstack-start-zephyr.target.spec.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/vite-plugin-tanstack-start-zephyr/package.json
  - ZephyrCloudIO/zephyr-packages:**/libs/vite-plugin-tanstack-start-zephyr/README.md
---

# Configure TanStack Start for Zephyr

## Setup

Read the application's existing Vite config and the installed versions of `vite`
and `@tanstack/react-start` before editing. Keep `tanstackStart()`, the React
plugin, and any Worker, CSS, or path plugins already present. If
`vite-plugin-tanstack-start-zephyr` is missing, install it as a development
dependency only when dependency changes are authorized.

The installed package declares peers on Vite 7 or 8 and `@tanstack/react-start`
1.x. It publishes from Vite's `buildApp` phase, so do not try it on Vite 5 or 6;
upgrade only when authorized.

Add `withZephyr()` to the existing plugin list:

```typescript
import { defineConfig } from 'vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { withZephyr } from 'vite-plugin-tanstack-start-zephyr';

export default defineConfig({
  plugins: [tanstackStart(), viteReact(), withZephyr()],
});
```

`withZephyr()` returns one plugin object, not an array, so add it directly
rather than spreading it. `withZephyrTanstackStart` is a deprecated alias for
the same function; keep it working in existing configs but write `withZephyr`
in new code. The plugin is `enforce: 'post'` with a post-ordered `buildApp`
hook, so it runs after TanStack Start's own build work wherever it is listed.

Use this package instead of `vite-plugin-zephyr`. Do not add the generic plugin
alongside it; both would try to publish the same application.

## Module Federation

This integration does not install federation plugins and does not resolve
`zephyr:dependencies` into remote URLs. Its `mfConfigs` and `federation`
options are publication metadata forwarded unchanged, and they are required
only for TAP packages. Read [output and TAP packages](references/output-and-tap.md)
before setting them. The shared `zephyr-module-federation` guide covers the
cross-project host and remote model.

## Publication lifecycle and runtime target

Run the application's normal `vite build`. Publication happens once, after
every Vite environment reports that it is built and TanStack Start has finished
post-processing such as prerendering. If any environment is incomplete the
plugin throws instead of starting child compilers or publishing a partial
deployment. A build path that skips Vite's `buildApp` phase publishes nothing.

The plugin uploads the whole output root (`dist/` under the Vite root unless
`outputDir` is set): server, client, public, and prerendered files form one
snapshot. Ordinary deployments are SSR snapshots whose server entry defaults
to `server/index.js` inside that root. SSR snapshots run in Zephyr's
Cloudflare-based edge runtime, so keep a Worker-targeted server build; the
package's example app uses `@cloudflare/vite-plugin` with
`viteEnvironment: { name: 'ssr' }`. Read
[output and TAP packages](references/output-and-tap.md) when the emitted server
entry, output directory, or snapshot type differ from the defaults.

## Avoid misleading fixes

- Do not spread `withZephyr()` or replace it with `vite-plugin-zephyr` to fix
  ordering; this plugin already runs last in the `buildApp` phase.
- Do not set `entrypoint` to a source file such as `src/server.ts`. It must be
  an emitted file inside the output root; paths containing `..` are rejected.
- Do not add `target: 'tap-app'` to an ordinary web app. TAP switches the
  default snapshot to CSR and requires paired federation metadata.
- Do not treat a successful Vite build as publication. Upload errors are logged
  and the build continues unless `ZE_FAIL_BUILD=true` is set; only option
  validation and incomplete environments always fail the build.
- Do not put credentials in `ZE_PUBLIC_*`; those values are client-visible.

## Verify completion

Run the authorized build with the application's existing package runner.
Confirm `dist/` contains the expected client output and the server entry, and
that the build prints `Deployed to Zephyr's edge in ...ms.` followed by a
version URL. Plugin progress lines such as `TanStack Start deployment
successful!` appear only with `DEBUG=zephyr:upload`, so do not wait for them. A
build without credentials can establish local output correctness, but not live
deployment success. Report that distinction.

On failure, keep the actionable error (for example a missing server entrypoint
or an incomplete environment) and fix the matching configuration. Do not
silently drop the Worker build, switch to CSR, or claim a partial build was
deployed.
