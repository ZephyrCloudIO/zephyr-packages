# zephyr-packages skill spec

## Attribution review corrections, 2026-10-03

At baseline `8f468124`, the maintainer requested resolving PR #645 review comments
and CI. Preserve fail-open Vite initialization unless ZE_FAIL_BUILD=true. Each
engine generation promotes an existing adapter boundary or takes one start copy;
CLI passes its pre-command boundary through creation and verifiers call the real
promotion method. Captures defer committed blame to changed comparison files;
HEAD comparison reuses matching bytes and batches remaining blobs. Header
rewrites preserve hunk text, Grok hook matchers include native mutating tools, and
blank storage answers retain preferences. Invalid configuration authorizes no
sharing. Remote failures retain local evidence and warn while deployment proceeds
without a reference. Storage commands require existing explicit enablement.
The production build-ID service returned HTTP 500 in prior Ubuntu CI; retain
strict end-to-end deployment validation and verify the corrected PR head.

## Attribution storage extension, 2026-10-03

At baseline `c9e9a1a4`, the maintainer requested local and remote storage and
confirmed that remote free accounts include both HEAD patches and structured
changed-line text; paid/BYOC can choose either, with both off by default. Local
now means no attribution in HTTP requests or public snapshots/build stats,
superseding the earlier emission behavior below. Private source receipts remain
local. Remote sends evidence through the new fixed authenticated gateway route,
bound to repository/application/build/snapshot IDs and an authoritative policy
revision, then emits only an acknowledged record reference. Account tier is
server-owned; no repo credential/URL/tier is accepted. Shared preferences are
Git-reviewable per repo, with atomic owner-only private overrides that can only
restrict sharing. Patches imply source text even when structured lines are off.
Full source/binary contents are not uploaded; remote differences use captured
HEAD as the baseline, which server comparisons must also possess.

The existing SDK/core and CLI guides own this workflow, with Vite linking to
the shared storage reference. Client checks use real private source captures,
the built CLI/SDK, and a real local HTTP fixture credential/endpoint. Production
endpoint authorization, policy administration, encrypted evidence storage,
retention, and BYOC routing remain control-plane work outside this workspace;
the SDK fails remote publication without that policy/acknowledgment. This batch
does not claim those server controls were verified.

## Live attribution extension, 2026-10-03

The maintainer requested actual hooks-off and model/effort switches on the same
generated app: Codex GPT-6.1-Sol high/low and GPT-6-Luna xhigh, followed by T3/Grok
models. Extend the existing Change Attribution guidance rather than creating a
second skill. Source receipts retain observed per-turn metadata and independent
Git workspace, prompt-initiator, and deployer identities. Launcher identity and
harness fields are self-reports; authenticated prompt identity is future work.
Codex 0.160.0 native hooks supply turn/tool IDs; bounded local rollouts supply
effort/provider/cumulative counters. Grok 1.0.46 supports native project hooks
and Git AI's public agent-v1 interface, avoiding a fork. Its tool events omit
prompt IDs, so active-prompt association is marked inferred, closes on stop or
cancellation, and does not claim exact linkage for background/concurrent work.
Grok reported USD ticks and usage include observation timestamps and partial
flags. Only a matching finished native turn refreshes the final ledger; snapshots
are not summed or allocated to code lines. Commit-only evidence without a tool
join does not invent effort or initiator metadata. Private ledgers/receipts remain
local and unsynchronized. Live checks and executable source-difference/build
verification are recorded in the review, separately from prior replay fixtures.

## Change Attribution addition, 2026-10-03

The maintainer requested an optional codemod offer and installation link, then a
trial on an actual generated example app. The name is Change Attribution; agent
integration installation is separate from capture opt-in. Extend the existing
shared `zephyr-core` setup/version task and `zephyr-cli` local-inspection task,
keeping the established package-only skill distribution and prior decisions.

The integration records the Git-eligible working tree independently from HEAD,
stores immutable source copies privately in the worktree Git directory, and
emits source fingerprints and self-reported provenance in snapshot/build-stat
contracts. It preserves unknown evidence, keeps deployer and contributor separate,
and checks exact checkpoint blob hashes before accepting Git AI ranges. The
Git AI adapter targets checkpoint/1.0.0 from 1.7.x, tested with 1.7.5; a compatible
fork can be selected by executable path. Native pre/post hooks preserve existing
project settings and require the agent's ordinary trust review. The upstream
Codex Stop preset is rejected in 1.7.5, so it is not installed by this setup.

Vite and CLI run-mode have build-start observations. Prebuilt and other adapter
flows remain publication-only. Boundary matching does not prove no transient
edits or capture every dependency/environment input. Control-plane persistence,
dashboard rendering, source-copy synchronization/retention, and broader adapter
build-start instrumentation remain future work; this SDK batch does not claim
them as implemented.

The generated React/Vite verifier uses real local SDK snapshot construction and
Git AI with explicit Codex/editor-event fixtures, plus an uninstrumented edit.
It disables cloud transport and checks three versions sharing a commit but
carrying distinct source records, AI/model, known-human, and unknown differences.
Hook replay evidence is distinct from a live agent session or human typing.
Unit tests cover opt-in, preserving hooks, dirty/staged/untracked/deleted/reverted
source, binary contents, stale hashes, model switches, and immutable receipts.
Git AI JSON blame omits known humans, so committed human evidence follows native
line origins into explicit authorship/3.0.0 human records in refs/notes/ai; a
regression test retains that evidence across a subsequent commit.
Validation results and remaining limits are recorded in the source review.

Package-owned skills describe the implementation shipped in their owning npm
package. Every published build integration and `zephyr-cli` ships a dedicated
skill, and two shared guides, `zephyr-core` and `zephyr-module-federation`,
ship with every published package. Only internal support libraries and the
`with-zephyr` codemod are exempt; `packagesWithoutDedicatedSkill` in
`scripts/sync-package-skills.mjs` lists them, and both the unit test and the
packed-archive verification fail when any other package lacks a dedicated
skill.

## Ownership and distribution

`create-zephyr-apps` retains project bootstrap and receipt guidance. Its existing
instructions are unchanged; the batch adds provenance and source mappings so
future CLI changes receive a meaningful review.

`zephyr-vite` owns Vite configuration, optional federation integration, plugin
ordering, and the publication lifecycle. Its conditional lifecycle reference
ships beside the entry point.

`zephyr-core` (SDK selection, setup, and the version/tag/environment model) and
`zephyr-module-federation` (host/remote wiring, `zephyr:dependencies`, and
build order) moved here from `ZephyrCloudIO/skills` so SDK setup guidance is
versioned with the SDK it describes. The canonical copies live in the root
`skills/` directory. `scripts/sync-package-skills.mjs` mirrors them into each
published package at `prepack` and during `pnpm build`; the mirrored
directories are ignored by Git, carry a `.zephyr-generated` marker that is
excluded from archives, and are never written over an authored directory or
through a symlink. `ZephyrCloudIO/skills` retains a platform-only `zephyr-core`
for users without an installed SDK and no longer ships
`zephyr-module-federation`. Dedicated package skills take precedence over the
shared guides for their supported task.

The monorepo uses package-only Intent distribution. Existing generator host
manifests remain untouched. Every published package lists `skills` in its
`files` allowlist and declares the `tanstack-intent` keyword, so its skills are
discovered only when the consumer selects that package.
Intent is a development tool, not a runtime dependency of the SDK.

Source mappings use repository-qualified Git globs with a leading `**/`.
Git 2.52 and 2.54 locally omit unchanged nested files when a literal-prefix
include is combined with Intent's dependency exclusion. The leading glob keeps
the intended files visible; verify the matched paths before recording reviews.

## Verification and remaining work

`src/package-output.spec.ts` exercises the real packed archive in disposable
consumer directories. It checks discovery against the installed version,
loading, bundled references, and consumer opt-out. Existing optional-peer tests
cover both ordinary imports and the failure when federation is requested
without its peer.

`src/lib/vite-api.integration.spec.ts` executes the skill's actual setup example
against a real Vite build with a network-disabled Zephyr engine fixture. It
checks complete publication exactly once and rejects a config that only builds
local assets. The existing lifecycle tests cover SSR and multi-environment
behavior. The task and discovery prompts are kept with that fixture.

These deterministic checks do not establish fresh-agent selection or successful
live deployment. Neither has been claimed as passing. Register additional SDK
skills only after their developer task and implementation evidence are assessed.

`scripts/verify-package-skills.mjs` (`pnpm skills:verify-packages`, run
after `pnpm build`) packs every published package into a disposable consumer.
It requires the shared guides to match the canonical copies byte for byte, to be
discoverable and loadable from the installed package at its version, to resolve
every local Markdown link inside the packed package, and to exclude
maintainer-only metadata. `src/package-skills.spec.ts` covers the mirroring
rules and asserts that every published manifest has the pack hook and allowlist.

No CI workflow runs the skill checks; maintainers run them locally with the
installed, lockfile-pinned Intent 0.5.0.

This workspace uses native TypeScript 7, whose default module does not expose
the JavaScript compiler API required by Intent 0.5.0. `scripts/intent.mjs`
redirects compiler resolution only in its Intent process to the pinned
private `@zephyrcloudio/intent-tooling` development package. Keeping its compiler
in that package also prevents its CLI binaries from replacing the root's native
compiler. SDK compiler selection and runtime dependencies stay unchanged. Use
`pnpm skills:intent` for direct Intent
commands; both the check scripts and CI use that wrapper.

## Coverage and batch history

- 2026-10-02: Adopted Intent 0.5.0 at source baseline
  `103bbe4a2e433e3393e84406df2e047cd4c5fe17`. Registered the existing
  `create-zephyr-apps` guidance and preserved its prior description as purpose.
  Added the package-owned Vite pilot against SDK 1.4.2 without changing runtime
  implementation. Kept shared workflows in the separate skills repository and
  recorded the unassessed integrations and missing fresh-consumer evidence.

- 2026-10-02: Moved `zephyr-core` and `zephyr-module-federation` from
  `ZephyrCloudIO/skills` into the root `skills/` directory with their content
  and descriptions intact, and distributed both with all 23 published packages.
  The packaged `zephyr-core` gained a preamble because many packages that carry
  it, such as `zephyr-edge-contract`, are not build plugins. Its SDK picker now
  includes `vite-plugin-vinext-zephyr` and the `zephyr-cli` fallback. The
  companion skills repository retired its federation skill and narrowed its
  `zephyr-core` to platform workflows.

- 2026-10-02: Added dedicated skills for every remaining build integration
  (`zephyr-webpack`, `zephyr-rspack`, `zephyr-rsbuild`, `zephyr-modernjs`,
  `zephyr-rollup`, `zephyr-rolldown`, `zephyr-parcel`, `zephyr-tanstack-start`,
  `zephyr-vinext`, `zephyr-astro`, `zephyr-nuxt`, `zephyr-metro`,
  `zephyr-repack`, `zephyr-rspress`) and for `zephyr-cli`, following the Vite
  pilot's structure. Guidance follows source where READMEs disagree. Every
  fenced TypeScript/JavaScript example type-checks against the built package
  and its real or packed framework peer, with negative checks for rejected
  options; built packages were probed at runtime without credentials. Fixed
  `ze-cli` recommending nonexistent `@zephyrcloud/*` packages and replaced the
  deprecated `withZephyrTanstackStart` in the shared guide.

## Source findings for maintainers

The skill research found these README or implementation issues. The skills
describe current source behavior; none of these was changed in this batch.

- READMEs show nonexistent APIs: `zephyrPlugin` (Rollup), `withZephyr({ deploy,
environment })` and `@module-federation/webpack` (webpack), the object form
  `withZephyr()(config)` (Re.Pack), `entryFiles` (Metro), Parcel's
  `reporters` programmatic option, and `appTools({ bundler })` (Modern.js 3).
- README version requirements disagree with peer ranges for Rollup, Rspack,
  Astro, Rspress, Modern.js, Metro, and Re.Pack.
- Rolldown prefixes non-HTML snapshot paths with `output.dir` while exempting
  `index.html`, so `dir: 'dist'` publishes `dist/main.js` beside a root HTML
  file that references `./main.js`.
- Rsbuild 2 uses its JavaScript HTML plugin by default, while the Rspack import
  map is injected only through `HtmlRspackPlugin` hooks.
- Nuxt returns without publishing, even with `ZE_FAIL_BUILD=true`, when the
  expected server entry or output is missing, and static uploads may be rooted
  at `.output` rather than `.output/public`.
- Modern.js publishes client and server configs independently, so
  `snapshotType` and `entrypoint` have no effect there.
- `verify_mf_fastly_config` in Re.Pack appears to have an inverted condition.
- Metro's missing `withModuleFederation` check throws `ERR_INVALID_MF_CONFIG`,
  whose message describes an invalid library name, and the command wrapper
  rethrows it as `ZE00000: Unknown error` with the `{{library_name}}`
  placeholder unfilled.
- Upload progress and skip messages in the Nuxt, TanStack Start, Vinext, and
  Rspress plugins use debug-gated `ze_log` namespaces, so silent skips print
  nothing without `DEBUG=zephyr:*`. The skills verify against the always-visible
  `Deployed to Zephyr's edge` line instead.
- Rollup, Rolldown, Parcel, and the Vite framework plugins record but do not
  resolve `zephyr:dependencies`.

- 2026-10-02: Addressed review findings. Verification steps now rely on the
  always-visible deploy line and version URL rather than debug-gated logs; the
  Metro skill describes the real missing-config symptom; `ze-cli` guidance uses
  `--verbose`, which works in every position; `workspace:*` is documented as
  falling back to the latest published version, matching
  `resolve_remote_dependency`. Package-owned `library_version` lines carry the
  release-please marker and are listed as generic extra files, with a unit test
  that fails on drift, and reference prose no longer pins a version.
  `verify-package-skills.mjs` compares every file of the shared guides. The Vite
  example test compiles the skill example with Vite instead of the Intent-only
  compiler, and the package declares `@tanstack/intent` for its discovery tests.
