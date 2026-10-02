# Output and snapshots

Use this reference for module options, custom output paths, static sites,
`app.baseURL`, or TAP packages. It describes behavior verified against
`zephyr-nuxt-module` 1.4.2.

## Options

Set options under the `zephyr` key in `nuxt.config`:

| Option         | Default                                | Meaning                                                  |
| -------------- | -------------------------------------- | -------------------------------------------------------- |
| `outputDir`    | `nitro.output.dir`, else `.output`     | Nitro output root, resolved from the project root.       |
| `entrypoint`   | first of `server/index.{mjs,js,cjs}`   | Server entry relative to the output root.                |
| `snapshotType` | `ssr` if an entry is found, else `csr` | Snapshot transport type.                                 |
| `target`       | Zephyr's default web artifact          | One of `web`, `ios`, `android`, `tap-app`.               |
| `mfConfigs`    | none                                   | Federation containers in the snapshot; required for TAP. |
| `federation`   | none                                   | Build-stat metadata paired with `mfConfigs`.             |
| `hooks`        | none                                   | `ZephyrBuildHooks`, such as `onDeployComplete`.          |

An unsupported `target` throws when the module is set up. The module reads
`nitro.output.dir` and `nitro.output.publicDir` from `nuxt.config`, not from
Nitro's resolved defaults, so leaving them unset means `.output` and no
separate public directory.

## Which files are uploaded

- SSR snapshot: the whole output root, so the server entry and `public/` keep
  their emitted paths. If `nitro.output.publicDir` points outside the output
  root, its files are added under a `public/` prefix.
- CSR snapshot: `nitro.output.publicDir` when configured, otherwise the whole
  output root.
- Setting `zephyr.outputDir` ignores `nitro.output.publicDir` entirely.

For a static build with no server entry, such as `nuxt generate`, check the
`output=` path in the `Zephyr upload starting` log. Without a configured public
directory the snapshot root is the Nitro output root, with the generated pages
under `public/`. If the pages must sit at the snapshot root, point
`zephyr.outputDir` at the public directory:

```typescript
export default defineNuxtConfig({
  modules: ['zephyr-nuxt-module'],
  zephyr: {
    outputDir: '.output/public',
  },
});
```

## Entry points and base URL

An explicit `entrypoint` may be relative or absolute; leading `./` and `/` and
the output root prefix are stripped. Existence is not checked, so confirm the
file was emitted. `snapshotType: 'csr'` drops any entrypoint. When
`app.baseURL` is set, it is applied as the snapshot base path for assets and
the SSR entrypoint.

## Retries and skipped runs

Upload runs once per process from Nuxt's `close` hook; a failed attempt can be
retried if the hook fires again. The module is skipped entirely when Nuxt is
in dev mode, when `npm_lifecycle_event` is `postinstall`, when the Nuxt
command is `prepare`, or when `prepare` appears anywhere in the process
arguments.

## TAP packages

`target: 'tap-app'` publishes a TAP package. Every emitted file is read as raw
bytes, including paths an ordinary build skips, and a read error aborts
publication. In an SSR snapshot, a public directory outside the output root is
added without the `public/` prefix, and a path collision between the two
sources fails publication.

TAP requires non-empty `mfConfigs` and `federation` arrays of equal length.
Each `mfConfigs` entry needs a unique `name` and `filename`, and exactly one
`federation` entry with the same `name` whose `remote` equals that `filename`.
This is validated just before upload; like other upload errors, a mismatch is
logged and the build still succeeds unless `ZE_FAIL_BUILD=true` is set. Take
the metadata from the package SDK; the module does not derive or alter it.

```typescript
export default defineNuxtConfig({
  modules: ['zephyr-nuxt-module'],
  zephyr: {
    target: 'tap-app',
    mfConfigs: [{ name: 'desktop', filename: 'targets/desktop/remoteEntry.mjs' }],
    federation: [{ name: 'desktop', remote: 'targets/desktop/remoteEntry.mjs' }],
  },
});
```

A single complete container is also copied to the legacy `mfConfig` snapshot
field; multi-container packages use only `mfConfigs`.
