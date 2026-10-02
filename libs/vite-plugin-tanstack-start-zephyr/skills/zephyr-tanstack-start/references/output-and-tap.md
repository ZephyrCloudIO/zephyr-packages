# Output and TAP packages

Use this reference when the emitted server entry, output directory, or snapshot
type differs from the defaults, or when publishing a TAP package. It describes
behavior of the installed `vite-plugin-tanstack-start-zephyr` release.

## Options

All options are optional for ordinary TanStack Start deployments.

| Option         | Default                               | Meaning                                                  |
| -------------- | ------------------------------------- | -------------------------------------------------------- |
| `outputDir`    | `dist` under the Vite root            | Output root to upload. Relative paths resolve from root. |
| `snapshotType` | `ssr`; `csr` when `target: 'tap-app'` | Snapshot transport type.                                 |
| `entrypoint`   | `server/index.js` for SSR             | Emitted server entry relative to `outputDir`.            |
| `target`       | Zephyr's default web artifact         | One of `web`, `ios`, `android`, `tap-app`.               |
| `mfConfigs`    | none                                  | Federation containers in the snapshot; required for TAP. |
| `federation`   | none                                  | Build-stat metadata paired with `mfConfigs`.             |

The plugin always uploads the output root, not `build.outDir`, because Vite's
server environment points `build.outDir` at a subdirectory.

## SSR entrypoints

The entrypoint names an emitted file inside the output root. Leading `./`,
`/`, and `dist/` prefixes are stripped and backslashes are normalized. A path
that escapes the output root fails when the config resolves. After the build,
an entrypoint that was not emitted fails publication with
`TanStack Start server entrypoint "..." was not emitted`.

Inspect the actual output tree before choosing a value. If the Worker build
emits its entry under a different name, set it explicitly:

```typescript
import { withZephyr } from 'vite-plugin-tanstack-start-zephyr';

withZephyr({ entrypoint: 'server/index.mjs' });
```

Do not set `snapshotType: 'csr'` to silence a missing server entry for an
application that needs server rendering, server functions, or API routes.

## TAP packages

`target: 'tap-app'` publishes a TAP package. It defaults to a CSR snapshot, so
no server entry is required, and it uploads every emitted file as raw bytes,
including paths an ordinary web deployment skips.

TAP requires non-empty `mfConfigs` and `federation` arrays of equal length.
Each `mfConfigs` entry needs a unique `name` and `filename`, and exactly one
`federation` entry with the same `name` whose `remote` equals that `filename`.
Validation runs when `withZephyr()` is called and again just before upload, so
invalid metadata fails before the build starts. TanStack Start does not infer
this metadata; take it from the package SDK.

```typescript
import { withZephyr } from 'vite-plugin-tanstack-start-zephyr';

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

To publish a TAP SSR package instead, also set `snapshotType: 'ssr'` and an
emitted `entrypoint`. A single complete container is also copied to the legacy
`mfConfig` snapshot field; multi-container packages use only `mfConfigs`.
