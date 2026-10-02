# Publication details

Use this reference for integration options, deployment hooks, uploaded file
selection, or TAP packages. It describes behavior verified against
`zephyr-astro-integration` 1.4.2.

## Options

`withZephyr()` takes an optional `ZephyrAstroOptions` object:

| Option       | Default                       | Meaning                                                  |
| ------------ | ----------------------------- | -------------------------------------------------------- |
| `target`     | Zephyr's default web artifact | One of `web`, `ios`, `android`, `tap-app`.               |
| `mfConfigs`  | none                          | Federation containers in the snapshot; required for TAP. |
| `federation` | none                          | Build-stat metadata paired with `mfConfigs`.             |
| `hooks`      | none                          | `ZephyrBuildHooks`, such as `onDeployComplete`.          |

An unsupported `target` throws when `withZephyr()` is called. The package
re-exports the `ZephyrAstroOptions`, `ZephyrBuildHooks`, and `DeploymentInfo`
types.

```typescript
import { defineConfig } from 'astro/config';
import { withZephyr } from 'zephyr-astro-integration';

export default defineConfig({
  integrations: [
    withZephyr({
      hooks: {
        onDeployComplete(info) {
          console.log(`Deployed ${info.url}`);
        },
      },
    }),
  ],
});
```

## Lifecycle

- `astro:config:setup` adds a Vite plugin that rewrites `ZE_PUBLIC_*` reads,
  except for TAP packages.
- `astro:config:done` creates the Zephyr engine from Astro's project root.
- `astro:build:done` starts a Zephyr build, collects the output directory, and
  uploads it.

`astro dev` does not run `astro:build:done`, so it never publishes.

## Uploaded files

Ordinary sites upload the files in Astro's client output directory, skipping
`.map` files, `node_modules`, `.git`, `.DS_Store`, and `thumbs.db`. A
directory read failure is only logged as a warning and can leave the upload
empty, so treat an empty or unexpectedly small publication as a failure to
investigate.

## TAP packages

`target: 'tap-app'` publishes a TAP package. It reads every emitted file as
raw bytes, including paths an ordinary site skips, and aborts publication on a
read error instead of uploading a partial package. It also leaves source and chunk bytes
unchanged by not registering the `ZE_PUBLIC_*` rewrite.

TAP requires non-empty `mfConfigs` and `federation` arrays of equal length.
Each `mfConfigs` entry needs a unique `name` and `filename`, and exactly one
`federation` entry with the same `name` whose `remote` equals that `filename`.
Astro validates this in `astro:build:done`, before upload. Like other upload
errors, a mismatch is logged and the Astro build still succeeds unless
`ZE_FAIL_BUILD=true` is set. Take the metadata from the package SDK; the
integration does not derive or alter it.

```typescript
import { withZephyr } from 'zephyr-astro-integration';

withZephyr({
  target: 'tap-app',
  mfConfigs: [{ name: 'desktop', filename: 'targets/desktop/remoteEntry.mjs' }],
  federation: [{ name: 'desktop', remote: 'targets/desktop/remoteEntry.mjs' }],
});
```

A single complete container is also copied to the legacy `mfConfig` snapshot
field; multi-container packages use only `mfConfigs`.
