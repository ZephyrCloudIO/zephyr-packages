# Compiler arrays and publication

Use this reference for webpack config arrays, SSR snapshots, late HTML, base
paths, or publication failures. It describes behavior of the installed `zephyr-webpack-plugin` release.

## When publication happens

Zephyr appends one plugin per compiler. Each successful compilation is uploaded
from `processAssets` at the report stage, after other asset processing. With
`wait_for_index_html: true`, the upload is deferred to `afterEmit` so HTML that
another plugin finalizes late in the compilation is included.

A compilation with errors is never uploaded. Watch rebuilds run the same hooks
again; the plugin has no development-mode skip.

## Config arrays

Wrap the exported array once: `withZephyr(options)([client, server])`. The
wrapper creates one engine and coordinates every compiler into one snapshot,
published only after all compilers finish successfully.

- Each compiler's `name` identifies it; unnamed compilers get generated names.
  `dependencies` between named compilers are respected.
- A compiler whose `target` is `node`, `async-node`, a versioned `node`, or
  `electron-main` is treated as a server. Any server compiler makes the snapshot
  `ssr`; otherwise it is `csr`. Pass `snapshotType` to override the inference.
- When compilers write to different `output.path` directories, their assets are
  prefixed with the path relative to the common output root.

```typescript
import type { Configuration } from 'webpack';
import { withZephyr } from 'zephyr-webpack-plugin';

const client: Configuration = { name: 'client', target: 'web' };
const server: Configuration = { name: 'server', target: 'node' };

export default withZephyr({
  snapshotType: 'ssr',
  entrypoint: 'server/index.js',
})([client, server]);
```

`snapshotType` and `entrypoint` have no effect on a single config.

## SSR entrypoints

Without `entrypoint`, an SSR snapshot uses the first emitted match among
`server/index.{js,mjs,cjs}`, `ssr/index.{js,mjs,cjs}`, and `index.{js,mjs,cjs}`,
then any emitted `server.*` or `index.*` file. An explicit `entrypoint` is a path
relative to the shared output root. It must stay inside the snapshot and must
be emitted; otherwise publication fails instead of guessing.

## Base paths

The snapshot base comes from the HTML plugin's `base` option, otherwise from a
string `output.publicPath`. `auto`, `/`, and `./` mean the root. A function
`publicPath` cannot be read and only produces a warning. Every compiler in an
array must resolve to the same base, or publication fails.

## Failure semantics

For a single config, configuration and publication errors are logged and the
webpack build continues. Set `ZE_FAIL_BUILD=true` when the build must fail on
them. For arrays, a configuration error rejects the wrapper and releases the
shared build instead of waiting for a compiler that will never report.

`hooks.onDeployComplete(info)` runs only after a successful publication with a
version URL; `info.url` is that URL. The exported `onDeploymentDone()` promise
resolves when a publication attempt ends, including failed attempts, so it is
not proof of success.

## Public variables and targets

The plugin emits `zephyr-manifest.json` with resolved remotes and public
variables. Unlike the Rspack plugin, it does not rewrite `ZE_PUBLIC_*` reads or
inject an import map. The `zephyr-core` guide covers public variables.

`target: 'tap-app'` publishes SDK-locked mini-app output: remotes are not
rewritten and output paths are kept package-relative. Use it only for that
artifact family.
