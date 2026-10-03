---
name: zephyr-cli
description: Upload build output to Zephyr with zephyr-cli (ze-cli); use when a
  stack has no Zephyr bundler plugin, when wrapping a build command or deploying
  a prebuilt directory, when publishing TAP mini-app output, or when running
  ze-cli doctor to inspect project readiness, or comparing opted-in Change Attribution records.
metadata:
  library: zephyr-cli
  library_version: '1.5.0' # x-release-please-version
  purpose: Publish an application's existing build output through ze-cli without a bundler plugin, choosing between run, deploy, watch, and doctor and confirming that an upload actually happened.
  domain: cli
  type: core
sources:
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-cli/src/cli.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-cli/src/index.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-cli/src/commands/run.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-cli/src/commands/attribution.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-cli/src/commands/deploy.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-cli/src/commands/watch.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-cli/src/lib/command-detector.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-cli/src/lib/publication-metadata.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-cli/src/doctor/schema.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-cli/README.md
---

# Publish build output with ze-cli

## Choose the integration

Prefer the stack's Zephyr bundler or framework plugin when one exists; the
bundled `zephyr-core` skill lists them. A plugin observes the real build graph,
while `ze-cli` only uploads a directory. Use `ze-cli` for stacks without a
plugin, such as plain `tsc`, `esbuild`, or `swc` builds, or for output produced
elsewhere.

Install `zephyr-cli` as a development dependency only when dependency changes
are authorized. It exposes the `ze-cli` binary. The project needs a
`package.json` and a Git repository with a remote, branch, and commit, because
Zephyr derives application identity from them.

## Pick the command

| Command                    | Use when                                                            |
| -------------------------- | ------------------------------------------------------------------- |
| `ze-cli [options] <build>` | Run the build, then upload the output directory it detects          |
| `ze-cli deploy <dir>`      | The output already exists in a known directory                      |
| `ze-cli watch <dir>`       | Iterating on TAP mini-app output only (`--target tap-app`)          |
| `ze-cli doctor [dir]`      | Inspecting readiness without installing, building, or auth          |
| `ze-cli attribution`       | Capturing/comparing local source records without auth or deployment |

```bash
ze-cli pnpm build
ze-cli deploy ./dist
ze-cli deploy ./dist --ssr
ze-cli doctor . --format json
```

For the default run command, put `ze-cli` options before the build command;
everything after the first non-flag argument is the command line. `deploy` and
`watch` take their options after the directory. `--target` accepts `web`
(default), `ios`, `android`, or `tap-app`.

Run mode detects the output directory statically from `npm`/`yarn`/`pnpm`
scripts (followed recursively), `tsc`, `webpack`, `rollup`, `vite`, `esbuild`,
and `swc`. Commands joined with `&&` run in order and upload their common output
ancestor. When a JavaScript config is too dynamic to analyze, run the build
yourself and use `ze-cli deploy <dir>` with the directory you know it writes.

## Change Attribution

Read the bundled `zephyr-core/references/change-attribution.md`. Enable only with
explicit opt-in via `with-zephyr . --attribution`; agent hook installation is a
separate choice. `ze-cli attribution capture --format json` returns a source ID,
and `ze-cli attribution compare <before> <after> --format json` accepts source IDs
or locally saved snapshot IDs. `-C <project>` selects the repository. Source
copies stay in the private Git directory; a fresh clone lacks those copies.

Run mode observes source before its build command and at snapshot creation.
`boundary-match` reports matching observations, not proof of exact compiler
inputs; prebuilt deployments use `publication-only`. Missing or stale Git AI
evidence remains unknown. Contributor identities are self-reported and separate
from the authenticated deployer. A removal's origin identifies the original
contributor, not the deleting actor. This repository emits metadata but does not
implement control-plane persistence or dashboard display.

## TAP mini-app publication

`--target tap-app` requires `--metadata <path>` pointing at the JSON sidecar the
TAP SDK emits, for `run`, `deploy`, and `watch`. The CLI rejects a missing,
malformed, or empty sidecar, and any entry whose `federation.remote` differs
from its `mfConfigs.filename`. `watch` rejects every other target and never
creates a development tag; the Zephyr control plane must already authorize one.

## Authentication

In an interactive terminal, Zephyr opens a browser login when no session
exists. In CI or any non-TTY shell there is no prompt: provide `ZE_CI_TOKEN`
through the CI secret store. Never print, commit, or echo the token, and never
place credentials in `ZE_PUBLIC_*` values, which are client-visible.

## Avoid misleading fixes

- Do not treat exit code 0 from run mode as proof of upload. When ze-cli cannot
  detect an output directory it prints "Could not detect output directory.
  Skipping upload." and returns without failing. Check stderr for that line,
  or switch to `ze-cli deploy <dir>`.
- Do not add `--target` or `--metadata` after the build command in run mode;
  they would be passed to the build tool instead of ze-cli.
- Do not stack `ze-cli` on top of a build that already runs a Zephyr bundler
  plugin; that publishes twice.
- Do not use `ze-cli watch` for web development servers; doctor reports this as
  `ZD0501`.
- Branch on doctor's `status`, `exitCode`, and finding `code`, not message text.
  Doctor exits `0` when healthy, `1` with findings, `2` for an invalid project
  path or manifest, and `3` when the scan cannot complete. Its deepest checks
  cover Rsbuild and Module Federation setups.

## Verify completion

Run the authorized command with `--verbose` to see the detected tool,
output directory, and asset count. Confirm the output directory holds the
expected assets and that Zephyr reports a published version URL. Without
credentials you can verify the build and directory detection, but not
deployment. Report that distinction, and keep any actionable `[ze-cli] Error:`
message rather than retrying blindly.
