# Publication commands

Use this reference for custom output paths, RNEF registration, hand-written
command wrappers, or `withZephyr` manifest options. It describes behavior of the installed `zephyr-metro-plugin` release.

## Command order

`bundle-mf-host` and `bundle-mf-remote` run the same Zephyr sequence around
the matching `@module-federation/metro` command:

1. Reject a `--platform` other than `ios` or `android`.
2. Load the Metro config. `withModuleFederation` must set the federation config
   during this step.
3. Create the Zephyr build, resolve `zephyr:dependencies` and federation
   remotes, and rewrite resolved remotes in place.
4. Update the federation manifest, then run the upstream bundle command.
5. Upload every file under `<root>/dist/<platform>` with build statistics, then
   finish the build.

The mode comes from `--dev` when it is a boolean (`true` is development);
otherwise `--mode production` or no mode is production, and any other
non-empty mode is development. Errors from any step are rethrown as a `ZephyrError`, and the
active build is rolled back. A command failure is therefore a real failure;
it is not downgraded to a log line.

## Output location

The upstream remote command writes to `<projectRoot>/dist/<platform>` unless
`--output` is given, in which case it writes to `<output>/<platform>`. Zephyr
always reads `dist/<platform>` relative to the CLI project root. Keep the
default output for any bundle that must be published. If the directory is
missing, Zephyr publishes no bundle files; this is intended for host bundles
that the native build writes elsewhere.

## React Native CLI and RNEF

`zephyrMetroReactNativeCli({ projectRoot })` resolves `@module-federation/metro`
relative to `projectRoot`, defaulting to `process.cwd()`. If it cannot be
resolved, the call throws an error asking for it to be installed in the app's
devDependencies. The host command keeps the upstream options and adds an
internal `--config-cmd [string]` pass-through for the Xcode build script.

`zephyrMetroRNEFPlugin(pluginConfig)` registers the same two commands through
the RNEF API. It passes the RNEF project root, platforms, and React Native path
to the command; a `platforms` entry in `pluginConfig` replaces the RNEF
platforms rather than merging with them.

## Hand-written command wrappers

`zephyrCommandWrapper(bundleFn, loadMetroConfig, updateManifest)` is
asynchronous. Await it to obtain the wrapped command before calling that
command:

```javascript
const bundle = await zephyrCommandWrapper(bundleFederatedRemote, loadMetroConfig, updateManifestFn);
await bundle([args], cliConfig, args);
```

The wrapped command expects the upstream argument shape: an array holding the
bundle options (including `platform`), the CLI config with `root`, and the CLI
options. Prefer the shipped adapters; only write a wrapper for a bespoke CLI.

## withZephyr options

`withZephyr(options)` returns an async function that takes and returns Metro's
`ConfigT`. Supported options are `target`, `remotes`, `manifestPath`, and
`failOnManifestError`; `name` is accepted but not read by the implementation.

- `manifestPath` defaults to `/zephyr-manifest.json`. The dev server answers
  that path with a no-cache JSON response, and the file is written under
  `<projectRoot>/assets/` without the leading slash.
- Manifest write failures are logged unless `failOnManifestError: true`.
- Other configuration errors return the original Metro config and log the
  error, unless `ZE_FAIL_BUILD=true` makes them throw.
- `withZephyrMetro` is a legacy alias of `withZephyr`.
