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
pnpm dlx with-zephyr . --attribution --attribution-agents codex claude grok
```

Storage is **local only**. Legacy remote settings fall back to local; new remote
settings are rejected. Read [local storage and reports](attribution-storage.md)
for export commands, browser import, retention, and release availability.

This writes repository-root `.zephyr/attribution.json` and merges hooks into
`.codex/hooks.json`, `.claude/settings.json`, and/or `.grok/hooks/zephyr-attribution.json`. Codex/Grok also install `.zephyr/attribution-hook.cjs` for metadata. It preserves existing hooks
and settings, validates documents before writing, and does not modify global
settings or grant hook trust. Review the Codex project hooks with `/hooks` and
restart agent sessions. Grok requires its native project trust review (`/hooks-trust`); this grants folder trust for its other project integrations too. T3 uses the same Grok integration through ACP. Install the Git AI binary separately through its linked
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

Attribution is omitted from uploaded snapshots and build stats. The authenticated
snapshot `creator` remains the deployer; contributor identities are self-reported
Git AI evidence, not verified people. `ze-cli attribution report <before> <after>`
exports aggregate JSON without source, paths, or contributor/session identities.
A compatible app can read it locally in Activity → Contributors; no attribution
API or cloud storage is involved. The detailed `compare` command still prints
local source differences; do not treat that output as an aggregate report.

## Harness, prompt initiator, effort, and usage

`workspaceHuman` identifies the Git author associated with a capture. Hooks-off AI
changes can appear under this identity, but their edit origin remains unknown.
The Git author, prompting human, and authenticated snapshot creator are separate.
Set `ZE_ATTRIBUTION_INITIATOR` in each person's launcher environment to record the
prompt initiator, and `ZE_ATTRIBUTION_HARNESS` to identify a wrapper such as `t3`
versus `codex-cli`. For T3, configure these in the selected project/provider's
environment settings. These are self-reports, not verified account assertions;
do not put a shared person's identity into team-wide hooks. Missing values stay
absent. A skill cannot reliably prove which person typed a prompt.

Codex/Grok collect a private metadata ledger under the worktree Git directory.
Line origins join exact tool-call identities into `sessions`, keyed by agent,
native session, and turn. Model and effort changes retain the earlier turn's
metadata. Codex effort/provider/counters use a bounded optional rollout adapter
tested with CLI 0.160.0; rollout parsing is not a stable API. Grok model/effort
use its observed summary and usage files, tested with CLI 1.0.46 and T3 0.0.44.
Unsupported/missing metadata does not invent defaults. Grok uses Git AI's public
`agent-v1` interface; no fork is required for this bridge.

Grok 1.0.46 omits prompt IDs on tool events. The bridge brackets an active prompt
from `UserPromptSubmit` to `Stop`/cancellation and marks `turnAssociation` as
`active-prompt`, an inferred association. Native Codex turn IDs are marked
`native-turn-id`. Unassociated/background completions stay unknown. Concurrent
or background Grok work needs stronger native event linkage before claiming an
exact prompt association. Integration labels alone do not prove the harness.

Usage and cost belong to sessions, not individual lines. Session-cumulative
snapshots are **not additive**, including across model switches or versions.
The captured cost is either unavailable or harness-reported USD ticks with an
observation timestamp and partial flag. It is not inferred from token counts or
presented as an invoice. [xAI defines one USD as 10 billion USD ticks](https://docs.x.ai/developers/cost-tracking).
Hook-time Grok counters can lag a turn; only a native
finished-turn match refreshes them, otherwise they remain incomplete/partial.
Historical source receipts retain their observed metadata. Raw prompts,
responses, transcript paths, and arbitrary provider fields are not published.

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
  inputs. Other engine adapters observe their generation start and publication;
  prebuilt deployments observe upload preparation rather than the earlier compiler
  invocation. Each generation uses at most one start and one publication copy.
- The Git AI working-log adapter supports `checkpoint/1.0.0` from Git AI 1.7.x,
  tested with 1.7.5. It accepts attribution only when the checkpoint's content
  hash matches the captured file. Stale checkpoints remain unknown. Committed
  blame is deferred to files changed in local comparisons, only for bytes
  matching the captured commit. Captures retain working-checkpoint ranges and
  mark matching committed bytes privately; unchanged files do not trigger blame
  processes at build start. HEAD trees are read once and missing baseline blobs
  in one batch. Comparison enrichment never rewrites the original receipts. Legacy untracked
  `Human` checkpoints are not known-human evidence.
  Since Git AI 1.7 JSON blame omits known humans, the adapter follows native Git
  line origins into explicit `authorship/3.0.0` human attestations in local
  `refs/notes/ai`. A commit's ordinary author is never sufficient evidence.
- `gitAiPath` can point to a compatible fork. Keep format changes behind the
  adapter; don't infer authorship from file style or the absence of AI marks.

To disable capture, set `enabled` to `false`. Remove the installed Git AI and metadata command
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

For live trials, retain a source receipt after each real agent edit. The
`scripts/verify-live-attribution.mjs <generated-app> <manifest.json>` verifier
loads those private records, checks the expected model/effort/harness and actual
added line, compares versions sharing a commit, then builds the final app using
real Vite/SDK snapshot construction with cloud transport disabled. Manifest
cases specify `name`, `sourceId`, `file`, `text`, `kind`, and optional `model`,
`effort`, `harness`. These receipts are local observations, not cloud deployments.
Do not substitute hook replay for a requested live model/harness trial.
