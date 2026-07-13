---
summary: Defines the `tap-app` publication contract implemented by Zephyr packages.
read_when:
  - Publishing a TAP mini-app through a Zephyr plugin or CLI.
  - Adding a bundler adapter that must support `tap-app`.
  - Debugging descriptor, lock, or Module Federation artifact transport.
---

# TAP mini-app publication

`tap-app` is a first-class Zephyr build target. It is the artifact family for a
descriptor-backed TAP package; it is not a replacement for `web`, `ios`, or
`android` application builds.

Every public adapter that can publish a generic JavaScript artifact accepts a
`target: 'tap-app'` option. Its enclosing API differs by framework; for example,
Vite/Rollup adapters use:

```ts
withZephyr({ target: 'tap-app' });
```

The target is validated at runtime as well as in TypeScript. Untyped JavaScript
configuration that supplies another value fails before dependency resolution or
publication; it never silently falls back to `web`.

## What Zephyr packages own

The TAP SDK assembles and semantically validates the package descriptor, graph
lock, target entries, and presentation assets. Zephyr packages transport that
already-validated output exactly:

- `manifest.tap.json`, graph/asset locks, PNG/SVG assets, and arbitrary
  transitive files retain their original bytes, paths, hashes, and sizes.
- A pre-emitted `zephyr-manifest.json` is retained. Zephyr emits its ordinary
  fallback manifest only when no artifact owns that path.
- Two assets that normalize to the same snapshot path—for example
  `tap/lock.json` and `tap\\lock.json`—fail publication instead of selecting an
  arbitrary file.
- Module Federation metadata is represented as arrays: `federation` in build
  stats and `mfConfigs` in snapshots. Each target/container remains addressable;
  no adapter drops entries after the first one.

Adapters that inspect a bundler Federation configuration (xpack, Vite, and
Rspress) derive these arrays. The CLI reads them from its required JSON sidecar.
Other generic-output adapters accept caller-provided `mfConfigs` and
`federation` options from the SDK and, for `tap-app`, require non-empty arrays
with one matching `name`/`filename === remote` pair per container. A legacy
singular `mfConfig` is sent only for a true one-container package.
Every TAP publication revalidates those arrays at the shared upload boundary,
so a missing, duplicate, or mismatched container cannot be published by an
adapter-specific path.

A conventional multi-target package has entries such as:

```text
manifest.tap.json
targets/desktop/remoteEntry.mjs
targets/desktop/mf-manifest.json
targets/mobile/remoteEntry.mjs
targets/quickjs/remoteEntry.mjs
```

The SDK may use different lock filenames or add target-specific chunks. Zephyr
does not infer, regenerate, or reinterpret those files.

## Adapter coverage

Use `target: 'tap-app'` with:

- `zephyr-rspack-plugin`, `zephyr-rsbuild-plugin`, `zephyr-webpack-plugin`, and
  `zephyr-modernjs-plugin` for Module Federation builds.
- `vite-plugin-zephyr`, `rollup-plugin-zephyr`, and `zephyr-rolldown-plugin`
  for generic ESM publication.
- `parcel-reporter-zephyr`, `zephyr-astro-integration`, `zephyr-nuxt-module`,
  `zephyr-rspress-plugin`, `vite-plugin-vinext-zephyr`, and
  `vite-plugin-tanstack-start-zephyr` when their framework output is the TAP
  package artifact.

For Parcel, configure one `distDir` at the package root. Separate Parcel output
roots are rejected for `tap-app` rather than being prefixed into a different
descriptor/lock namespace.

Metro and Re.Pack intentionally remain iOS/Android React Native integrations.
They must not be configured as a `tap-app` publisher; TAP desktop/mobile ESM
entries are emitted by the package SDK and a compatible JavaScript bundler.

## Development watch

Use the CLI when the SDK or bundler already writes a package output directory:

```sh
ze-cli watch ./dist --target tap-app --metadata ./dist/zephyr-publication.json --debounce 250
```

The command publishes an initial immutable snapshot, then coalesces filesystem
events and publishes each settled output change. It only watches the mini-app
output—never a TAP host build. The Zephyr control plane is the authority for
authorizing and advancing a development tag; the client does not fabricate a
tag or treat a mutable tag as a release identity.

The SDK must emit the required JSON metadata sidecar with non-empty `mfConfigs`
and `federation` arrays. Each `federation.remote` must match the corresponding
`mfConfigs.filename`; the CLI rejects missing or inconsistent TAP metadata
rather than selecting one container from a multi-target package. See the
`zephyr-cli` README for the full sidecar schema and `run`/`deploy` examples.

## Boundaries

This repository deliberately does not duplicate TAP SDK or control-plane work:

- Descriptor/lock schema validation, SHA/SRI calculation, image safety, parent
  graph semantics, and release selection are TAP SDK responsibilities.
- Snapshot persistence, tag authorization/resolution, and follow-tag
  notifications are Zephyr control-plane responsibilities.
- TAP validates the resolved immutable package graph before activation.

The package-side contract is complete only when these artifacts reach the
control plane unchanged and the receiving services consume the typed target and
multi-entry metadata.
