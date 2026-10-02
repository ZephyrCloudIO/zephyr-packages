# zephyr-packages skill spec

Package-owned skills describe the implementation shipped in their owning npm
package. This pilot covers the existing generator skill and one Vite integration
skill; other SDKs remain unassessed.

## Ownership and distribution

`create-zephyr-apps` retains project bootstrap and receipt guidance. Its existing
instructions are unchanged; the batch adds provenance and source mappings so
future CLI changes receive a meaningful review.

`zephyr-vite` owns Vite configuration, optional federation integration, plugin
ordering, and the publication lifecycle. Its conditional lifecycle reference
ships beside the entry point. General product and cross-project federation
workflows remain in `ZephyrCloudIO/skills`, without becoming an implicit local
prerequisite or a second copy of version-sensitive SDK instructions.

The monorepo uses package-only Intent distribution. Existing generator host
manifests remain untouched. The Vite skill is included in the package's existing
`files` allowlist and discovered only when the consumer selects the package.
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
