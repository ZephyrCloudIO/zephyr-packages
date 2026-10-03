# Change Attribution

Use when enabling optional human/AI attribution or comparing versions built from
uncommitted source. The Zephyr Attribution integration uses Git AI; a skill alone
cannot reliably observe file writes.

## Enable with consent

The `with-zephyr` CLI offers **Enable Change Attribution** after SDK setup in an
interactive terminal. It links to [Git AI installation](https://usegitai.com/docs/get-started)
and separately offers **Install Agent Integrations**. Non-interactive invocation
does not opt in; `--dry-run` and `--no-attribution` do not create configuration.
Explicit non-interactive setup:

```bash
pnpm dlx with-zephyr . --attribution --attribution-agents codex claude
```

This writes repository-root `.zephyr/attribution.json` and merges hooks into
`.codex/hooks.json` and/or `.claude/settings.json`. It preserves existing hooks
and settings, validates documents before writing, and does not modify global
settings or grant hook trust. Review the Codex project hooks with `/hooks` and
restart agent sessions. Install the Git AI binary separately through its linked
instructions; the codemod does not run a downloaded installer. Skip the agents
flag for source capture only, or when existing Git AI hooks already cover the
agents. The installer may also configure agent hooks globally; avoid duplicating
the same integration at global and project scope.

Known human evidence needs a Git AI editor integration, available through the
same setup link. Agent hooks alone do not establish which remaining edits were
human. Missing evidence always remains **unknown**.

## Source records and comparisons

An opted-in SDK captures repository-wide Git-eligible working-tree files,
including unstaged and untracked files, rather than substituting HEAD or the
index. A deterministic fingerprint covers paths, file modes, and content hashes.
Private immutable source copies and version-to-source receipts stay under the
worktree's Git directory, in `zephyr-attribution/`. They are never build assets.
Comparisons require those local copies; a fresh clone cannot retrieve them from
Zephyr or Git AI notes. They are not synchronized or pruned automatically.

Install `zephyr-cli` to inspect the records without login or deployment:

```bash
pnpm exec ze-cli attribution status
pnpm exec ze-cli attribution capture --format json
# Use the two sourceId values returned by capture, or local Zephyr snapshot IDs.
pnpm exec ze-cli attribution compare <before> <after> --format json
```

Use `-C <project>` to select another project. Differences report additions,
removals, binary changes, and file modes. Attribution on a removed line describes
its original contributor; it does not identify who deleted it. Reverted edits
disappear from the net source difference.

Snapshot and build-stat `changeAttribution` metadata contain hashes and recorded
line origins (human, tool, model, session), not raw source or prompts. The
authenticated snapshot `creator` remains the deployer; contributor identities
are self-reported Git AI evidence, not verified people. This repository emits
the metadata; server persistence and a dashboard version-difference UI require
control-plane support and are not provided here.

## Coverage and correctness

- Git-ignored files, common build output (`dist`, `build`, `.next`, `.nuxt`,
  `.output`), dependency/cache folders, `.env*`, `.npmrc`, `.netrc`, and private
  key extensions are excluded. Add repository-relative prefixes to `exclude`
  in the configuration. This is a scoped source record, not a complete build
  reproduction or a general secret detector.
- Captures are limited to 20,000 files and 50 MiB. Submodules need exclusions.
  Failures produce `unavailable` metadata rather than a partial source claim.
- Vite and `ze-cli <build>` observe source at build start and snapshot creation.
  `boundary-match` means those two observations match; it does not prove no
  transient edit occurred between observations. `changed-during-build` means
  the records differ and neither should be presented as the exact consumed
  inputs. Other adapters and prebuilt deployments report `publication-only`.
- The Git AI working-log adapter supports `checkpoint/1.0.0` from Git AI 1.7.x,
  tested with 1.7.5. It accepts attribution only when the checkpoint's content
  hash matches the captured file. Stale checkpoints remain unknown. Committed
  JSON blame is used only for files matching the HEAD content. Legacy untracked
  `Human` checkpoints are not known-human evidence.
  Since Git AI 1.7 JSON blame omits known humans, the adapter follows native Git
  line origins into explicit `authorship/3.0.0` human attestations in local
  `refs/notes/ai`. A commit's ordinary author is never sufficient evidence.
- `gitAiPath` can point to a compatible fork. Keep format changes behind the
  adapter; don't infer authorship from file style or the absence of AI marks.

To disable capture, set `enabled` to `false`. Remove the installed Git AI command
entries from project hook documents to stop those hooks, retaining other hooks.
Existing local receipts remain available until explicitly deleted.

## Maintainer verification

`scripts/verify-change-attribution.mjs` builds an actual generated React/Vite app
three times with the local SDK. It uses the real Git AI binary and replays Codex
and editor hook fixtures, including a model field. It replaces the cloud transport
and checks same-commit source differences containing AI, known-human, and unknown
origins. Hook replays verify integration compatibility; they do not establish
that a real human typed the fixture or that a live Codex session used that model.

After building `create-zephyr-apps`, `with-zephyr`, `zephyr-agent`, `zephyr-cli`,
and `vite-plugin-zephyr` locally:

```bash
node libs/create-zephyr-apps/dist/index.js /tmp/zephyr-attribution-demo --template react-vite --package-manager pnpm --git --install --json
node libs/with-zephyr/dist/index.js /tmp/zephyr-attribution-demo --attribution --attribution-agents codex --git-ai-path /absolute/path/to/git-ai
node scripts/verify-change-attribution.mjs /tmp/zephyr-attribution-demo /absolute/path/to/git-ai
```

Use a disposable app: the verifier edits its template source and writes a private
`demo-report.json`. It needs Git AI's background service running. A replay failure
or missing evidence must fail verification, not be relabeled as human or AI.
