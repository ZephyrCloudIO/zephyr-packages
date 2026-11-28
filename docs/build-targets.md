---
summary: Lists the Zephyr build targets and which entry points accept each one.
read_when:
  - Changing supported build targets or target validation.
  - Adding a bundler plugin or any other public entry point that takes a `target`.
  - Publishing worker builds.
---

# Build targets

`zephyr-edge-contract` owns the public list of build targets (`ZEPHYR_BUILD_TARGETS`):

| Target    | Meaning                                                              |
| --------- | -------------------------------------------------------------------- |
| `web`     | Browser build (default).                                             |
| `ios`     | React Native iOS bundle.                                             |
| `android` | React Native Android bundle.                                         |
| `tap-app` | Opaque TAP mini-app artifact, see [tap-app](tap-app-publication.md). |
| `worker`  | Worker build, published with `ze-cli`.                               |

## Who accepts what

| Entry point                                                                                     | `web`, `ios`, `android`, `tap-app` | `worker`     |
| ----------------------------------------------------------------------------------------------- | ---------------------------------- | ------------ |
| `ze-cli` (`deploy`, run command)                                                                | accepted                           | accepted     |
| `zephyr-agent` engine and upload helpers                                                        | accepted                           | accepted     |
| JS bundler plugins (webpack, rspack, rsbuild, rollup, rolldown, vite, parcel, astro, nuxt, ...) | accepted                           | **rejected** |
| Metro and Re.Pack                                                                               | `ios`, `android` only              | **rejected** |

Bundler plugins validate their `target` option with `assertZephyrBundlerBuildTarget`
(exported by `zephyr-edge-contract` and re-exported by `zephyr-agent`). Their public option
types use `ZephyrBundlerBuildTarget`, so TypeScript users also get a compile-time error.
Any new bundler plugin must use this guard at its entry point, before it forwards the
target.

## Publishing a worker build

Example only, not guidance:

```bash
ze-cli deploy ./dist --target worker
```

Choose the uploaded files with a `zephyr.config.json` (see the
[zephyr-cli README](../libs/zephyr-cli/README.md#zephyrconfigjson)). `ze-cli deploy`
refuses a folder that holds a `wrangler.toml`, `wrangler.json` or `wrangler.jsonc`
without one. `run` and `watch` do not apply that refusal.

A bundler plugin that receives `target: 'worker'` throws a `TypeError`.

Example only, not guidance:

```text
withZephyr({ target }) does not support "worker" in bundler plugins. Publish worker builds
with ze-cli (ze-cli deploy <directory> --target worker). Worker support in bundler plugins
may come later.
```
