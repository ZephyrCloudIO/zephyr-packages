---
name: zephyr-cli
description: Upload build output to Zephyr with zephyr-cli (ze-cli); use when a
  stack has no Zephyr bundler plugin, when wrapping a build command or deploying
  a prebuilt directory, when publishing TAP mini-app output, when publishing a
  skills repo or @module-federation/mcp tools build privately to the
  organization's Zephyr MCP (with optional CI eval results), when running ze-cli
  doctor to inspect project or MCP provider readiness, or comparing opted-in
  Change Attribution records.
metadata:
  library: zephyr-cli
  library_version: '1.6.0' # x-release-please-version
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
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-cli/src/doctor/analyze.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-cli/src/mcp/*.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-cli/README.md
  - ZephyrCloudIO/zephyr-packages:**/docs/mcp-provider-publication.md
---

# Publish build output with ze-cli

## Choose the integration

Prefer the stack's Zephyr bundler or framework plugin when one exists; the
bundled `zephyr-core` skill lists them. A plugin observes the real build graph,
while `ze-cli` only uploads a directory. Use `ze-cli` for stacks without a
plugin, such as plain `tsc`, `esbuild`, or `swc` builds, or for output produced
elsewhere.

Install `zephyr-cli` as a development dependency only when dependency changes
are authorized. It exposes the `ze-cli` binary; without installing, run it as
`npx zephyr-cli ...` (never `npx ze-cli`, which is a different package). A web
project needs a `package.json` and a Git repository with a remote, branch, and
commit, because Zephyr derives application identity from them. An MCP skills
repo needs no `package.json`; see [MCP provider publication](#mcp-provider-publication).

## Pick the command

| Command                    | Use when                                                            |
| -------------------------- | ------------------------------------------------------------------- |
| `ze-cli [options] <build>` | Run the build, then upload the output directory it detects          |
| `ze-cli deploy <dir>`      | The output already exists in a known directory, or an MCP provider  |
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
After explicit enablement, use `attribution configure --storage local|remote` for shared repo preferences,
and `--storage local --local` for a private restriction. Read the companion
`attribution-storage.md` for remote tier defaults and authenticated policy.
Local mode sends no attribution; remote snapshots contain only a record reference
after the dedicated endpoint acknowledges the matching build. Remote failure
warns and continues deployment with private evidence and no attribution reference.

Run mode observes source before its build command and at snapshot creation.
`boundary-match` reports matching observations, not proof of exact compiler
inputs; prebuilt deployments use `publication-only`. Missing or stale Git AI
evidence remains unknown. Contributor identities are self-reported and separate
from the authenticated deployer. A removal's origin identifies the original
contributor, not the deleting actor. This repository emits metadata but does not
implement control-plane persistence or dashboard display.

## MCP provider publication

`ze-cli deploy` publishes skills and tools privately to the organization's
Zephyr MCP when the directory classifies as an MCP provider. The same classifier
runs for `deploy`, `run`, `watch`, and `doctor`:

1. `<dir>/mcp-provider.json` exists: a built provider artifact.
2. No `<dir>/package.json`: `tools/*.ts` files fail with ZD0732; a `skills/`
   directory is a skills repo.
3. `<dir>/package.json` opts in (a dependency on `@module-federation/mcp`, or
   `mcp: true` in `<dir>/zephyr.config.*`): tool files fail with ZD0732 until
   built; a `skills/` directory is a skills repo.
4. Anything else is a normal web deploy; a `skills/` folder there is published
   publicly and ze-cli warns.

`deploy`, `run`, and `watch` evaluate `zephyr.config.*` like a build, so any value
that resolves to `mcp: true` opts in; `doctor` only sees a literal `mcp: true`.

```bash
npx zephyr-cli doctor .                       # ZD07xx checks, no auth, no writes
npx zephyr-cli deploy .                       # skills repo, built in memory
npx zephyr-cli deploy dist                    # @module-federation/mcp/rslib output
npx zephyr-cli deploy . --eval-results ./eval-results.json
```

- Checks run before authentication and abort on any error. A skills repo uploads
  only `SKILL.md`, `references/`, `assets/`, and `scripts/` plus a generated
  `mcp-provider.json` and `catalog.json`; `evals/`, dotfiles, `*.map`, and
  symlinks never leave the machine. A built artifact uploads exactly the files
  its catalog lists and skips other `dist/` files with a warning.
- In a built artifact, `tools/index.js` must be one self-contained UTF-8 module
  (no `import`, `export ... from`, `import()`, or `node:`/`cloudflare:`
  specifier), and every served `SKILL.md` must parse to the catalog's
  frontmatter; both are ZD0741. zephyr-agent runs the frontmatter comparison on
  every upload, bundler plugins included. A `runtime.compatibilityDate` before
  `2025-11-17` and a catalog path with a backslash or an empty segment are
  ZD0741. A `SKILL.md` link must name a served file, not a folder (ZD0716).
- A skills repo's identity is `appName` from `<dir>/zephyr.config.*` (must be a
  valid skill name), else the git repository name, else the directory name, at
  version `0.0.0`. It never uses a `package.json` name or a parent directory.
- MCP deploys accept only `--target web` and reject `--metadata` and `--ssr`.
  `run` and `watch` refuse MCP providers: use `deploy`.
- Each skill holds at most 512 files and 16 MiB in total, at most 5 MiB per
  file (ZD0719).
- `--eval-results` takes strict `zephyr-evals/v1` JSON (unknown keys are
  rejected at every level), is deploy-only, and is validated against the
  published skills before anything uploads.
- Deploys fail closed unless the application is on the default Zephyr Cloudflare
  edge (`MCP_PRIVATE_SNAPSHOTS`); the API's rejection shows only field paths.

Doctor JSON uses schema `1.1.0`, adds an optional `mcp` section, and gives each
ZD07xx finding a `rule` id. ZD07xx warnings alone exit `0`; other warnings keep
their exit code. The full
code table is in the package README; the contract is in
`docs/mcp-provider-publication.md` of the repository.

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
  cover Rsbuild and Module Federation setups and, for MCP providers, ZD07xx.
- Do not add a `package.json` or `--target` to make a skills repo deploy; it is
  identified without one, and a `package.json` name is ignored for it.
- Do not deploy a tools repo root; build it with the `@module-federation/mcp/rslib`
  preset and deploy `dist` (ZD0732 otherwise).

## Verify completion

Run the authorized command with `--verbose` to see the detected tool,
output directory, and asset count. Confirm the output directory holds the
expected assets and that Zephyr reports a published version URL. Without
credentials you can verify the build and directory detection, but not
deployment. Report that distinction, and keep any actionable `[ze-cli] Error:`
message rather than retrying blindly.
