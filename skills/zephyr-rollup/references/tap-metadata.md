# TAP Module Federation metadata

Use this reference when a Rollup build publishes TAP containers or forwards
federation metadata through `mfConfigs` and `federation`. This reference
describes behavior of the installed `rollup-plugin-zephyr` release.

## What the options do

Rollup has no federation container discovery here. `mfConfigs` lists every
independently published container. `federation` carries the paired build-stat
records. The plugin forwards both to the upload and does not build, rewrite,
or load any container.

```typescript
import { withZephyr } from 'rollup-plugin-zephyr';

withZephyr({
  target: 'tap-app',
  mfConfigs: [
    { name: 'desktop', filename: 'targets/desktop/remoteEntry.mjs' },
    { name: 'quickjs', filename: 'targets/quickjs/remoteEntry.mjs' },
  ],
  federation: [
    { name: 'desktop', remote: 'targets/desktop/remoteEntry.mjs', library_type: 'module' },
    { name: 'quickjs', remote: 'targets/quickjs/remoteEntry.mjs', library_type: 'module' },
  ],
});
```

Take these values from the TAP SDK's output for the containers that were
actually built. Do not hand-author them to get past validation.

## Validation for `target: 'tap-app'`

The plugin validates when `withZephyr()` is called and again before upload.
Any violation is a local build error:

- Both arrays must be non-empty and have the same length.
- Every `mfConfigs` entry needs a non-empty `name` and `filename`. Every
  `federation` entry needs a non-empty `name` and `remote`.
- Names, filenames, and remotes must not repeat.
- Each `mfConfigs` entry must pair by `name` with a `federation` entry whose
  `remote` equals its `filename`.

For other targets the arrays are optional and are forwarded without this
validation.

## Single and multiple containers

With exactly one complete `mfConfigs` entry, the plugin also sends it as the
legacy single `mfConfig`. The single `federation` record then fills the
dashboard's singular `remote`, `mf_manifest`, `library_type`, `exposes`, and
`shared` fields.

With several containers, only the full arrays are sent and those singular
fields are cleared. Do not reorder the arrays to promote a "primary" container,
because the plugin intentionally never selects one.
