# Output and TAP packages

Use this reference when the server entry cannot be detected, the output
directory or snapshot type differs from the defaults, or when publishing a TAP
package. It describes behavior verified against `vite-plugin-vinext-zephyr`
1.4.2.

## Options

All options are optional for ordinary Vinext deployments.

| Option         | Default                               | Meaning                                                  |
| -------------- | ------------------------------------- | -------------------------------------------------------- |
| `outputDir`    | `dist` under the Vite root            | Output root to upload. Relative paths resolve from root. |
| `snapshotType` | `ssr`; `csr` when `target: 'tap-app'` | Snapshot transport type.                                 |
| `entrypoint`   | auto-detected for SSR                 | Emitted server entry relative to `outputDir`.            |
| `target`       | Zephyr's default web artifact         | One of `web`, `ios`, `android`, `tap-app`.               |
| `mfConfigs`    | none                                  | Federation containers in the snapshot; required for TAP. |
| `federation`   | none                                  | Build-stat metadata paired with `mfConfigs`.             |
| `hooks`        | none                                  | `ZephyrBuildHooks`, such as `onDeployComplete`.          |

A missing output root fails publication with
`Vinext output directory does not exist`.

## SSR entrypoint detection

When `snapshotType` is `ssr` and no `entrypoint` is given, the plugin checks
the finalized output tree in this order and uses the first match:

1. `server/index.js`, `server/index.mjs`, `server/index.cjs` (App Router).
2. `ssr/index.*`, then `rsc/index.*`, with the same three extensions.
3. `index.js`, `index.mjs`, or `index.cjs` beside an emitted `wrangler.json` or
   `wrangler.jsonc` (Pages Router Worker directory).

If nothing matches, publication fails with `Could not infer Vinext entrypoint`.
Inspect the output tree and set the emitted path explicitly:

```typescript
import { withZephyr } from 'vite-plugin-vinext-zephyr';

withZephyr({ entrypoint: 'server/index.js' });
```

An explicit entrypoint has leading `./`, `/`, and `dist/` stripped. A path that
escapes the output root, or one that was not emitted, fails publication. Do not
set `snapshotType: 'csr'` to silence a missing entry for an app that needs
server rendering.

## Uploaded copy versus emitted files

For ordinary deployments, unused `import 'node:fs'` and `import 'node:path'`
side-effect imports are removed from JavaScript under `server/` in the uploaded
copy only; the files on disk are unchanged. The serialized RSC assets manifest
is added as `__vite_rsc_assets_manifest.js` in the `rsc` and `ssr` output
directories when Vite's RSC plugin exposes it. Neither transformation runs for
TAP packages.

## TAP packages

`target: 'tap-app'` publishes a TAP package verbatim. It defaults to a CSR
snapshot, so no server entry is required.

TAP requires non-empty `mfConfigs` and `federation` arrays of equal length.
Each `mfConfigs` entry needs a unique `name` and `filename`, and exactly one
`federation` entry with the same `name` whose `remote` equals that `filename`.
Validation runs when `withZephyr()` is called and again just before upload, so
invalid metadata fails before the build starts. Vinext does not infer this
metadata; take it from the package SDK.

```typescript
import { withZephyr } from 'vite-plugin-vinext-zephyr';

withZephyr({
  target: 'tap-app',
  mfConfigs: [
    {
      name: 'desktop',
      filename: 'targets/desktop/remoteEntry.mjs',
      library: { type: 'module' },
    },
  ],
  federation: [
    {
      name: 'desktop',
      remote: 'targets/desktop/remoteEntry.mjs',
      library_type: 'module',
    },
  ],
});
```

To publish a TAP SSR package instead, also set `snapshotType: 'ssr'`; the same
entrypoint detection applies. A single complete container is also copied to the
legacy `mfConfig` snapshot field; multi-container packages use only
`mfConfigs`.
