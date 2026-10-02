# zephyr-packages skill spec

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

`scripts/verify-package-skills.mjs` (`pnpm skills:verify-packages`, run in CI
after `pnpm build`) packs every published package into a disposable consumer.
It requires the shared guides to match the canonical copies byte for byte, to be
discoverable and loadable from the installed package at its version, to resolve
every local Markdown link inside the packed package, and to exclude
maintainer-only metadata. `src/package-skills.spec.ts` covers the mirroring
rules and asserts that every published manifest has the pack hook and allowlist.

Root CI validation and release review remain read-only. They use the installed,
lockfile-pinned Intent 0.5.0 and SHA-pinned actions. The workflow does not create
review pull requests or publish fixes.

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
- Rollup, Rolldown, Parcel, and the Vite framework plugins record but do not
  resolve `zephyr:dependencies`.
