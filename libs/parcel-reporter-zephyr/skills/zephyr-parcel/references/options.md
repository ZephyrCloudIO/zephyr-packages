# Reporter options

Use this reference when the Parcel reporter needs options, publishes TAP
containers, or builds more than one Parcel target. This reference describes
behavior of the installed `parcel-reporter-zephyr` release, checked with Parcel
2.16.4.

## Project-local reporter module

Parcel loads reporters from `.parcelrc` and uses the module's default export.
The package's named `createZephyrReporter(options)` returns a reporter of the
same kind as the default export, so a project file can configure it:

```javascript
// zephyr-reporter.js
const { createZephyrReporter } = require('parcel-reporter-zephyr');

module.exports = createZephyrReporter({
  hooks: {
    onDeployComplete(info) {
      console.log(`Zephyr deployment: ${info.url}`);
    },
  },
});
```

```json
{
  "extends": "@parcel/config-default",
  "reporters": ["...", "./zephyr-reporter.js"]
}
```

Relative paths resolve from the `.parcelrc` file. Options are optional:
`target` (`'web'`, `'ios'`, `'android'`, or `'tap-app'`), `hooks`, `mfConfigs`,
and `federation`. An unsupported target or invalid TAP metadata throws when
the module is loaded.

## TAP targets

TAP builds pass the SDK-produced container records together:

```javascript
const { createZephyrReporter } = require('parcel-reporter-zephyr');

module.exports = createZephyrReporter({
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

Validation runs when the reporter is created and again before upload:

- Both arrays must be non-empty and have the same length.
- Every entry needs a non-empty `name`, plus `filename` for `mfConfigs` entries
  or `remote` for `federation` entries.
- Names, filenames, and remotes must not repeat.
- Each `mfConfigs` entry pairs by `name` with a `federation` entry whose
  `remote` equals its `filename`.

A TAP build must emit into one `distDir`, and every file must be inside it.
Paths are uploaded relative to that directory without any prefix. With exactly
one container, it is also sent as the legacy single `mfConfig`. For non-TAP
targets the arrays are optional and are forwarded without validation.

## Output paths for multiple targets

For non-TAP builds the reporter maps each emitted file to a snapshot path:

- With one `distDir`, paths are relative to that directory.
- With several `distDir`s, paths are relative to their nearest shared parent
  directory. For example, `dist/client` and `dist/server` publish as
  `client/...` and `server/...`.
- When the only shared parent is the filesystem root, each path is prefixed
  with its sanitized Parcel target name.
- Two different files that map to the same snapshot path fail the publication
  instead of overwriting each other.
