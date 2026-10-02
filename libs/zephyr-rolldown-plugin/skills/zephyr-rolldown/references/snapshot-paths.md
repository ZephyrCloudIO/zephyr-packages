# Snapshot paths and TAP metadata

Use this reference when choosing `output.dir`, debugging missing files in a
published Rolldown snapshot, or publishing TAP containers. This reference
describes behavior of the installed `zephyr-rolldown-plugin` release.

## How `output.dir` becomes a prefix

In `writeBundle`, the plugin passes Rolldown's `output.dir` value, exactly as
configured, to Zephyr as the snapshot base path. Rolldown reports `undefined`
when `dir` is omitted or when `output.file` is used. Zephyr then normalizes
that value:

- `undefined`, `''`, `'.'`, `'./'`, and `'/'` add no prefix.
- Leading and trailing slashes are removed. `'dist'` and `'./dist/'` both become
  `dist/`.
- An absolute path keeps all of its segments. `dir: path.resolve('dist')`
  therefore publishes under a prefix that contains the machine's directory
  names.
- A value containing `..` adds no prefix.

The prefix is applied to every uploaded file except paths ending in
`index.html`. With `dir: 'dist'`, `index.html` is published at the root while
`main.js` is published as `dist/main.js`. A page that references `./main.js`
then fails to load its script.

If the existing config already sets `dir` and the app is served from the
snapshot root, report the mismatch. Rolldown writes to `dist` when `dir` is
omitted, so removing an explicit `dir: 'dist'` removes the prefix and leaves
the local output location unchanged. Removing any other `dir` value also moves
the local output, which other tooling may depend on. Make either change only
when it is authorized.

## TAP targets

With `target: 'tap-app'`, the plugin clears the base path so that SDK-locked
artifact paths are uploaded unchanged, whatever `output.dir` is. TAP builds
must pass `mfConfigs` and `federation` together:

```typescript
import { withZephyr } from 'zephyr-rolldown-plugin';

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

Validation runs when `withZephyr()` is called and again before upload:

- Both arrays must be non-empty and have the same length.
- Every entry needs a non-empty `name`, plus `filename` for `mfConfigs` entries
  or `remote` for `federation` entries.
- Names, filenames, and remotes must not repeat.
- Each `mfConfigs` entry pairs by `name` with a `federation` entry whose
  `remote` equals its `filename`.

With exactly one container, it is also sent as the legacy single `mfConfig`
and fills the dashboard's singular remote fields. With several containers, only
the full arrays are sent. For non-TAP targets the arrays are optional and are
forwarded without validation.
