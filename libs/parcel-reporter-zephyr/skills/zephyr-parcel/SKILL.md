---
name: zephyr-parcel
description: Configure and deploy Parcel applications with parcel-reporter-zephyr;
  use when adding the Zephyr reporter to .parcelrc, passing reporter options
  through createZephyrReporter, supplying TAP Module Federation metadata, or
  diagnosing when a Parcel build publishes to Zephyr.
metadata:
  library: parcel-reporter-zephyr
  library_version: '1.4.2'
  purpose: Register Zephyr as a Parcel 2 reporter in the project's .parcelrc so successful builds publish their emitted bundles without displacing Parcel's other reporters.
  domain: parcel
  type: core
sources:
  - ZephyrCloudIO/zephyr-packages:**/libs/parcel-reporter-zephyr/src/index.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/parcel-reporter-zephyr/src/index.test.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/parcel-reporter-zephyr/src/lib/on-build-start.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/parcel-reporter-zephyr/src/lib/on-build-success.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/parcel-reporter-zephyr/src/lib/on-build-success.test.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/parcel-reporter-zephyr/src/lib/get-assets-map.test.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/parcel-reporter-zephyr/package.json
  - ZephyrCloudIO/zephyr-packages:**/libs/parcel-reporter-zephyr/README.md
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-agent/src/lib/errors/handle-global-error.ts
---

# Configure Parcel for Zephyr

## Setup

Read the project's `.parcelrc` (if there is none, Parcel uses its default
config), its build scripts, and the installed package versions before editing.
The package declares `@parcel/plugin` and `@parcel/types` peer ranges of
`^2.0.0` and loads `@parcel/plugin` at runtime. If `parcel-reporter-zephyr` is
missing, install it as a development dependency only when dependency changes
are authorized.

Zephyr is a Parcel reporter, not a JavaScript plugin call. Register the
package's default export by name in the project's `.parcelrc`:

```json
{
  "extends": "@parcel/config-default",
  "reporters": ["...", "parcel-reporter-zephyr"]
}
```

`"..."` keeps the reporters from the extended config, which for
`@parcel/config-default` is `@parcel/reporter-dev-server`. Without it, the list
replaces them. When a `.parcelrc` already exists, add the package to its
`reporters` list and keep its other keys.

The application identity comes from the nearest `package.json` above the
directory Parcel runs in, not above the entry file. Run Parcel from the
application package so that a monorepo build is not published under the
workspace root's name.

## Pass reporter options

The default export takes no options. To set `target`, `hooks.onDeployComplete`,
`mfConfigs`, or `federation`, create a project-local reporter module that
default-exports `createZephyrReporter(options)`. Register it by relative path
in place of the package name, for example `"reporters": ["...", "./zephyr-reporter.js"]`.
Do not register both, because each would publish. Read
[reporter options](references/options.md) for the module, the TAP
validation rules, and multi-target output paths.

The reporter does not install a federation runtime or resolve
`zephyr:dependencies` into remote URLs. `mfConfigs` and `federation` only
describe containers that the build already emits. The shared
`zephyr-module-federation` guide covers the cross-project model.

## Publication lifecycle

- `buildStart` begins Zephyr initialization (package, git, and authentication)
  once per reporter instance.
- `buildSuccess` publishes. The reporter reads every emitted bundle file from
  disk, so the upload is the full output of the build graph.
- `buildFailure` marks the active Zephyr build as failed. A failed upload is
  rolled back so that a later build can retry.
- The reporter has no development-mode guard. Every successful build publishes,
  including rebuilds under `parcel` serve and `parcel watch`.
- Zephyr errors are logged, and `parcel build` still exits successfully, unless
  `ZE_FAIL_BUILD=true` is set. That setting makes the build fail.

## Avoid misleading fixes

- Do not call the reporter from a bundler config or pass the imported module to
  Parcel's constructor. The README's programmatic `reporters` option does not
  exist in Parcel 2's options. Use `.parcelrc`, which the API also reads.
- Do not drop `"..."` from an existing `reporters` list to make Zephyr run.
  Zephyr runs alongside the other reporters.
- Do not put a relative reporter path inside a shared Parcel config package.
  Parcel only accepts local plugins in a project's own config.
- Do not expect `zephyr:dependencies` to rewrite remote URLs in a Parcel build.
- Do not put credentials in `ZE_PUBLIC_*`; those values are client-visible.

## Verify completion

Run the authorized build with the application's existing script, for example
`parcel build index.html`. Confirm that Parcel emitted the expected files and
that Zephyr reported a successful publication with a version URL. A Parcel
build that prints `Built in` and exits 0 can still have failed to publish when
Zephyr errors were only logged. A build without credentials can show that the
local assets are correct, but not that a live deployment succeeded. Report that
distinction.

On failure, keep the actionable Zephyr error and fix the matching configuration
or authentication issue. Do not remove the reporter, suppress errors, or claim
that a build was deployed when its publication failed.
