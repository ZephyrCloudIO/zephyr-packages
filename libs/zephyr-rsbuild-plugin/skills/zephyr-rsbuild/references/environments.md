# Environments and publication

Use this reference for multi-environment or SSR Rsbuild builds, `ZE_PUBLIC_*`
reads, late HTML, base paths, or publication failures. It describes behavior
verified against `zephyr-rsbuild-plugin` 1.4.2.

## How the plugin hooks into Rsbuild

`withZephyr()` returns an Rsbuild plugin named `zephyr-rsbuild-plugin`. Its only
hook is a post-ordered `onBeforeCreateCompiler` handler. That handler runs after
`tools.rspack`, `modifyRspackConfig`, and the federation plugin's own compiler
setup, so it sees their final Rspack plugins. It then creates one Zephyr engine
and applies `zephyr-rspack-plugin` to every environment's config.

Each successful compilation contributes from `processAssets` at the report
stage. With `wait_for_index_html: true`, the contribution is deferred to
`afterEmit` so HTML finalized late in the compilation is included. Dev-server
and watch compilations run the same hooks; the plugin has no development-mode
skip.

## Coordinated snapshots

All environments publish together as one snapshot, only after every compiler
succeeds.

- Compilers whose Rspack `target` is `node`, `async-node`, a versioned `node`,
  or `electron-main` are servers. Any server makes the snapshot `ssr`;
  otherwise it is `csr`. `snapshotType` overrides the inference.
- When environments write to different output directories, their assets are
  prefixed with the path relative to the common output root.
- Every environment must resolve to the same base path, or publication fails.
  The base comes from the HTML plugin's `base` option, otherwise from a string
  `output.publicPath`; `auto`, `/`, and `./` mean the root.

## SSR entrypoints

Without `entrypoint`, an SSR snapshot uses the first emitted match among
`server/index.{js,mjs,cjs}`, `ssr/index.{js,mjs,cjs}`, and `index.{js,mjs,cjs}`,
then any emitted `server.*` or `index.*` file. An explicit `entrypoint` is a
path relative to the shared output root:

```typescript
import { defineConfig } from '@rsbuild/core';
import { withZephyr } from 'zephyr-rsbuild-plugin';

export default defineConfig({
  plugins: [withZephyr({ snapshotType: 'ssr', entrypoint: 'server/index.js' })],
});
```

The entrypoint must stay inside the snapshot and must be emitted; otherwise
publication fails instead of guessing.

## Public variables

For non-`tap-app` targets, the Rspack layer rewrites first-party
`process.env.ZE_PUBLIC_*` and `import.meta.env.ZE_PUBLIC_*` reads to an import
of the external module `env:vars:<application uid>`, emits
`zephyr-manifest.json`, and adds the matching `<script type="importmap">`
through `@rspack/core`'s native `HtmlRspackPlugin` hooks.

Rsbuild 2 generates HTML with its JavaScript HTML plugin by default
(`html.implementation: 'js'`). When the app reads `ZE_PUBLIC_*`, confirm the
emitted HTML contains that import map before relying on the rewritten reads.
If it is missing, report it with the Rsbuild version and HTML settings rather
than hand-writing a map. The `zephyr-core` guide covers public variables.

## Failure semantics

The coordinated build raises configuration and publication errors to Rsbuild
instead of only logging them, and it releases the shared build so a failed
environment cannot leave others waiting. A compilation with errors is never
uploaded.

`hooks.onDeployComplete(info)` runs only after a successful publication with a
version URL; `info.url` is that URL. The exported `onDeploymentDone()` promise
resolves when a publication attempt ends, including failed attempts, so it is
not proof of success.

## TAP artifacts

`target: 'tap-app'` publishes SDK-locked mini-app output: remotes are not
rewritten, the import map and `ZE_PUBLIC_*` loader are skipped, SSR is not
inferred from node compilers, and output paths stay package-relative. Use it
only for that artifact family.
