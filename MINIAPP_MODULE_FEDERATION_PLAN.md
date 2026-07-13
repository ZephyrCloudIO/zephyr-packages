# Repository workstream: `ZephyrCloudIO/zephyr-packages`

This draft PR is the complete handoff for the package/build integration owned by
this repository. The checklist below is repo-specific; the full cross-repository
plan follows unchanged.

## Repository checklist

- [ ] Make `tap-app` a first-class Zephyr build/publication target alongside
      `web` and `mobile`.
- [ ] Validate and publish the canonical TAP package descriptor and immutable
      graph lock, including package, publisher, namespace, release, target,
      contribution, permission, event, lifecycle, presentation, and collection
      identities.
- [ ] Support target-specific ESM Module Federation remote entries and exposed
      modules for desktop, mobile, QuickJS, worker, Node, and workflow-host.
- [ ] Publish parent collections that reference exact child package/release
      identities without merging child authority or lifecycle.
- [ ] Generate and verify per-asset SHA-256/SRI metadata for remote entries,
      chunks, descriptors, PNG/SVG role assets, and transitive runtime assets.
- [ ] Emit immutable version/snapshot and movable-tag metadata required by
      pinned, next-launch, OTA, and follow-tag policies.
- [ ] Support watch builds that publish only the mini-app and advance an
      authorized Zephyr development tag.
- [ ] Add fixture, schema, integrity, multi-target, collection, and publication
      tests plus documentation and release metadata.

---

# TAP Mini-App Package, Module Federation, Marketplace, and Runtime Plan

Status: implementation in progress; verified foundation and acceptance evidence recorded in Section 19  
Primary product work: [ZephyrCloudIO/ze-agency-tauri#5881](https://github.com/ZephyrCloudIO/ze-agency-tauri/pull/5881)  
Marketplace approval design/migration dependency: [ZephyrCloudIO/ze-agency-tauri#3891](https://github.com/ZephyrCloudIO/ze-agency-tauri/pull/3891); the audited PR cannot merge unchanged into the descriptor-backed package path  
Last research/coverage review: 2026-07-12

## 1. Purpose

This document consolidates the full mini-app discussion into one architecture and delivery plan. It covers:

- What PR #5881 and the current repositories already implement.
- The package, runtime, marketplace, security, and developer-experience contracts still required.
- Module Federation as the common executable package mechanism for UI, background, QuickJS, workflow, and mobile/desktop entry points.
- Every contribution a mini app may expose, individually or as a cohesive collection.
- Repository ownership, dependency order, release sequencing, and validation.

The goal is one TAP package mechanism rather than separate install formats for UI apps, tools, specialists, workflow nodes, chat blocks, background workers, or other contributions.

### 1.1 Research baseline

Repository state was inspected without overwriting user work. Repositories on `main` matched the fetched `origin/main` references shown below. The two feature worktrees were left on their branches and researched against `origin/main`/PR refs because they contain user-owned changes.

| Repository        | Inspected branch/HEAD                  | `origin/main` | Baseline note                                                                                                                                                                                                                                                                                                                                                             |
| ----------------- | -------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `core`            | `codex/miniapp-platform` / `8216621e3` | `37c97f6e`    | Current main plus two local lifecycle/ESM commits                                                                                                                                                                                                                                                                                                                         |
| `tap`             | `main` / `61e3931d`                    | `61e3931d`    | Current; reference-only by default                                                                                                                                                                                                                                                                                                                                        |
| `tap-e2e`         | implementation worktree / `f5b5f30`    | `cf232e2`     | Current main plus committed mini-app acceptance, PNG/SVG parent/child coverage, authoritative pin persistence/conflict/channel isolation, process/workflow serialization, residue cleanup, namespaced fixture identities, and atomic QuickJS release coverage; original user branch untouched                                                                             |
| `tap-miniapps`    | `codex/miniapp-platform` / `fae5916`   | `274f57b`     | Current main plus federated fixtures, explicit parent/plural child icon references, distinct publisher/organization assets, and the physical-package local Zephyr proof with target-scoped artifact verification                                                                                                                                                          |
| `ze-agency-tauri` | implementation worktree / `b033f1788`  | `4af17aac1`   | Feature worktree includes the latest product `main` baseline, the verified mini-app platform slice, recursive remote collections, desktop/mobile packages, QuickJS execution, native lifecycle, durable checkpoints, release gating, hardened presentation/registry work, authoritative pins, and committed canonical generated contracts; original user branch untouched |
| `ze-workflows`    | `codex/miniapp-platform` / `1eebb89e`  | `1eebb89e`    | Current main; no source delta                                                                                                                                                                                                                                                                                                                                             |
| `zephyr-cloud-io` | `codex/miniapp-platform` / `f3a2a43`   | `7767228`     | Current main plus local `tap-app` target support, authenticated immutable tag resolution, and authorized short-lived live-reload subscriptions                                                                                                                                                                                                                            |
| `zephyr-examples` | `main` / `881c3a83`                    | `881c3a83`    | Current                                                                                                                                                                                                                                                                                                                                                                   |
| `zephyr-mono`     | `main` / `6a392476`                    | `6a392476`    | Current; conditional scope                                                                                                                                                                                                                                                                                                                                                |
| `zephyr-packages` | `codex/miniapp-platform` / `cda17f5a`  | `e3a49e05`    | Current main plus `tap-app` publication and manifest-integrity support                                                                                                                                                                                                                                                                                                    |
| `zephyr-panel`    | `main` / `1c18061`                     | `1c18061`     | Fast-forwarded to current main; reference/conditional scope                                                                                                                                                                                                                                                                                                               |

This is a planning baseline, not a promise that the mutable remote branches will remain at these SHAs. The owning repositories were fetched again after validation; every feature branch above contains its then-current `origin/main`, and all clean repositories checked out on `main` were fast-forwarded. Future implementation must repeat that check and preserve user work.

## 2. Executive decisions

1. **Use one static TAP package descriptor plus one immutable dependency lock as the package contract.** The current implementation validates the descriptor and digest/SRI-locks the graph; the production Marketplace must additionally bind those exact bytes to publisher and reviewed-listing signatures. Module Federation supplies executable remote containers and exposed ESM modules; it does not replace package verification, installation, permissions, entitlements, lifecycle state, or rollback.
2. **Add `tap-app` as a Zephyr application/build target.** A TAP package may publish multiple target-specific Federation entries and a parent collection that references multiple child remotes.
3. **Keep trust, source, visibility, pricing, and entitlement as separate axes.** “Official,” “untrusted,” “public,” “private,” and “paid” are not interchangeable states.
4. **Run all third-party code in a runtime appropriate to its target.** UI code runs in isolated WebView/iframe realms, background code in QuickJS/worker realms, and workflow nodes through the canonical workflow runtime. Host-realm React execution is reserved for TAP core.
5. **TAP owns the application lifecycle.** Federation loading hooks participate in activation and rendering, while a TAP supervisor owns install, activate, mount, pre-pause, pause, pre-resume, resume, update, rollback, unmount, and uninstall.
6. **Use fresh runtime realms for updates.** Do not treat `registerRemotes(..., { force: true })` as an atomic upgrade or rollback mechanism.
7. **Make events, permissions, tasks, chat blocks, and MCP Apps first-class typed contributions.** No dynamic remote may mint undeclared tools, permissions, events, or renderers after its remote entry executes.
8. **A package defines possible permissions; TAP grants and evaluates them.** Specialists retain specialist identity and receive attenuated authority rather than inheriting a human role string.
9. **Messages persist versioned block data and a contentful fallback, never a mutable remote URL or arbitrary executable HTML.**
10. **Mini-app development must not require rebuilding TAP.** A developer watches only the package, publishes snapshots to a Zephyr tag, and runs TAP in a follow-tag mode that performs safe live replacement.
11. **TAP owns app discovery and pins.** The workspace rail gets a host Apps selector and only user-pinned workspace/global contributions; channel-only pins remain in the current channel's Apps selector.
12. **Treat package, contribution, publisher, workspace, and host icons as different identities.** Package and surface icon candidate sets remain plural and digest/SRI-locked today, with Marketplace signing still required; an author may use either a validated PNG or a passive SVG for an icon, and TAP selects a rendered candidate by effective theme, CSS size, and device-pixel ratio. Publisher logos come from verified organization profiles, workspace avatars remain workspace-owned, and the host Apps control uses the `Blocks` design-system glyph.
13. **An empty app registry is not a failed registry.** Apps UI surfaces distinguish loading, legitimately empty, ready, stale cached data, and unavailable initial data, and always expose a bounded retry when the registry can recover.

## 3. Requirements baseline

### 3.1 Installation sources and trust

A package may be added to a workspace through the Marketplace or installed from any of these sources:

1. A package bundled in `ze-agency-tauri`.
2. npm.
3. A GitHub repository.
4. A local zip file.
5. A local directory.
6. Zephyr.

Marketplace packages have two independent trust presentations:

- **Official:** approved through the team-owned process that must be finished by
  porting the useful approval/authz/audit concepts from PR #3891 into its
  descriptor-backed successor. The audited PR itself is not mergeable unchanged.
- **Untrusted:** not officially approved, including manually loaded sources. A publisher signature may still prove package namespace ownership without making the package officially trusted by TAP.

Every source resolves into the same internal form:

```text
source locator
  -> immutable source/release identity
  -> verified static descriptor
  -> immutable dependency graph lock
  -> content-addressed assets
  -> staged installation
```

The source adapters differ only in acquisition and provenance. They must share descriptor validation, safe archive extraction, hash/signature verification, dependency locking, permission review, and install/update transactions.

### 3.2 Marketplace publication

At publication time, the publisher chooses:

- `public` — discoverable according to Marketplace policy.
- `private-user` (publisher-only) — private to the publisher/owner. The final
  #3891 successor API should keep this source spelling or rename it once across
  every control-plane consumer rather than maintaining aliases.
- `private-workspace` — available only to one or more named workspaces.
- Free or paid.

Marketplace policy must also represent:

- Publisher identity and immutable namespace ownership.
- Verified publisher-profile branding resolved by publisher ID, separate from package artwork and TAP workspace avatars.
- Official approval state and review provenance.
- Package/release state: draft, submitted, approved, rejected, quarantined, deprecated, or removed.
- Supported targets and minimum TAP/SDK versions.
- License/entitlement requirements.
- Permission, runtime-effect, and data-handling review summaries.
- Signed package/collection/contribution icons, wordmarks, screenshots, hashes, moderation state, and accessible fallbacks.
- Pricing and billing product references without embedding credentials or price authority in the package.

Marketplace entitlement is an independent execution gate. Owning a package permission does not imply a paid entitlement, and paying for a package does not imply authorization.

Implementation status matters here: the canonical product model now has typed
Marketplace source, review, visibility, pricing, and entitlement records, but
those records are validation inputs rather than a server-backed Marketplace.
The host must receive them from an authenticated control-plane resolution; the
frontend or package may never manufacture them. The 2026-07-12 audit found PR
#3891 at head `99800344e` with a dirty merge state and an implementation tied to
the legacy `tap-apps` ZIP/minisign flow. Preserve its team-approval, authz, and
audit intent, but port that intent to the canonical publisher/listing/immutable
release/review/entitlement/install-resolution model described in Sections 11,
13.1, 14.1, and 19.6.

### 3.3 Package composition and updates

An organization may publish:

- A single mini app.
- A package containing several contributions.
- A parent collection referencing several independently versioned remotes.
- A suite in which each remote is a complete mini app or a partial mini app.
- Standalone contribution packages that other packages reference.

For example, an enterprise suite of ten apps may publish one parent entry that references ten child remotes. The parent may expose its own modules as well as compose child remotes, but it cannot rewrite child identities, permissions, event namespaces, signatures, or entitlements.

The host-validated, digest/SRI-locked parent descriptor enumerates the graph before any parent code runs; Marketplace publication must additionally sign that exact graph. Each child retains its own immutable identity, namespace, release, trust, visibility, permissions, target compatibility, and entitlement. The parent declares whether a child is required or optional and the fallback for a missing, private, unlicensed, quarantined, or target-incompatible child. Required-child failure blocks candidate activation; optional-child failure produces a bounded unavailable contribution and contentful fallback. Billing and visibility may be presented as a suite, but effective access is the restrictive intersection of parent and child policy unless a separately reviewed Marketplace bundle explicitly grants the child entitlement.

Installations support these update policies:

- **Pinned:** remain on an immutable release until explicitly changed.
- **Update on next launch (`next-launch`):** resolve and activate a newer approved release when TAP next launches the package.
- **OTA:** stage, validate, health-check, and atomically activate a release while TAP is running.
- **Follow tag (development):** track a mutable Zephyr tag and reload each newly published snapshot after validation.

All policies resolve to an immutable candidate graph before activation. Permission expansion blocks automatic activation until reviewed.

### 3.4 Target-specific entries

A package may expose different modules for:

- Desktop WebView/CEF.
- Mobile UI.
- Web UI where supported.
- QuickJS background/isolate execution.
- Browser or service worker execution.
- Node/SSR-like execution.
- Workflow sidecar/host execution.

One logical contribution may select different entries per target:

```yaml
targets:
  desktop:
    expose: ./ui/desktop
  mobile:
    expose: ./ui/mobile
  quickjs:
    expose: ./background
    runtime: quickjs
```

Target selection happens from the host-validated descriptor and immutable graph
lock, not from publisher code after loading. Production Marketplace signing
will add publisher/listing-release authenticity to this existing digest/SRI
integrity boundary.

## 4. What exists today

### 4.1 Original PR #5881 snapshot and the legacy app manifest

The original PR #5881 SDK model exposes only UI entries and tools. Its
product-side registry similarly stores those two contribution families, and
the UI placement vocabulary is limited to four sidebar positions. The current
feature worktree has since added a broad validated, digest/SRI-locked descriptor
union, but—as the consumer audit in Section 19.3 records—schema presence is not executable
integration; the legacy `defineApp` authoring surface and material host
consumers remain UI/tool-oriented.

The legacy `tap-apps` manifest is broader in packaging mechanics but still narrow in contribution semantics. It contains one UI entry, asset verification, specialist references, per-tool timeout metadata, workspace display settings, initialization scripts, standalone support, and device/platform capability requirements. It does not define task types, workflows, event catalogs, package permissions, chat blocks, or a complete typed contribution union.

The newer foundation taxonomy in the local `tap` repository is also incomplete: it currently recognizes only `miniapp | skill | specialist | browser-extension` as shared extension kinds.

The existing `requiredPlatformCapabilities` field describes whether a device/runtime can show an app. It is not a human/specialist authorization contract.

### 4.2 Core mini-app baseline and remaining migrations

The product's core mini-app baseline demonstrates requirements that are not represented in the legacy manifest:

| App              | Capabilities implied by the implementation                                                 |
| ---------------- | ------------------------------------------------------------------------------------------ |
| API Workbench    | UI, host/network effects, request actions, consent, credentials, result renderers          |
| Browser          | UI, native CEF profile, navigation/actions, tools, events, permissions, lifecycle          |
| Canvas           | UI, content/artifact renderer, commands, tools, chat cards, persistent state               |
| Code             | Editor UI, VFS/file handlers, LSP/provider integration, commands, tools                    |
| Course Demo      | UI/content template behavior and manifest/runtime registration consistency                 |
| Figma            | UI, integration/connector lifecycle, tools, file/content handler, credentials              |
| Google Workspace | OAuth/account setup, native execution, UI, tools, multiple specialists, resource selection |
| Mermaid Preview  | Typed renderer/content handler, assets, safe source handling                               |

The baseline declaration/runtime drift must be eliminated. Browser and the
legacy Figma path register tools at runtime that are absent from their old
manifests, while the old Course Demo manifest declared a tool that was not
registered. The descriptor-backed Design File Viewer and Kent conversions in
Section 19.3 close that drift for those two validation packages; they do not
migrate Browser or the remaining core apps. Every subsequent build/install
validator must compare descriptor declarations, Federation exposes, and
runtime registrations and reject mismatches.

### 4.3 `tap-miniapps`

The example repository already proves useful composition patterns:

- Its root manifest references independently built applications as a collection.
- Games exposes three UI surfaces from one app.
- Playground exposes UI and an executable tool.
- Playground consumes workflows but does not yet provide an executable
  package-contributed workflow fixture. The descriptor can declare `workflow`;
  the canonical `ze-workflows` consumer remains unimplemented.

These examples should become conformance fixtures for the new package model rather than inventing a separate example-only API.

### 4.4 Upstream Module Federation runtime baseline

Module Federation already provides the relevant module-delivery lifecycle:

```text
beforeInit -> init
beforeRequest -> afterMatchRemote -> afterResolve
loadEntry -> afterLoadEntry
beforeInitRemote -> beforeInitContainer -> container.init -> initContainer
afterInitRemote
beforeGetExpose -> afterGetExpose
beforeExecuteFactory -> afterExecuteFactory
onLoad -> afterLoadRemote
```

It supports remote entry types suitable for ESM and is already used across browser, Node/SSR-like, and other targets. Rsbuild/Rspack can emit ESM remote entries. TAP should use a custom verified entry loader so the same container protocol can run in WebView, worker, Node-like, and QuickJS adapters.

Important limitations:

- `registerRemote` means an in-memory remote is registered; it does not mean a workspace installation was committed.
- `afterInitRemote` can fire again for a cached container.
- Bridge render hooks can fire again when props change.
- Bridge destroy is framework cleanup and is not an awaited persistence boundary.
- Federation has no built-in pause/resume application state.
- Forced remote replacement clears runtime caches and globals and is not an update transaction.
- Runtime plugins cannot currently add arbitrary hook names. `PluginSystem` attaches only lifecycle keys present when the hook system is created.

### 4.5 Current task, permission, rich-chat, and MCP gaps

- TAP's security-first task foundation has canonical statuses, provenance, borrowed human authority, effective visibility, and per-listener event filtering, but no task type or custom attributes.
- The richer product CRDT task model has more fields but uses different status spellings/defaults and does not carry an equivalent authority envelope through every write path.
- Workspace authorization is action-based, while some surfaces still infer permissions directly from role strings.
- Tool permissions, workspace actions, consent lifetimes, specialist access control, and entitlements are separate current systems and need one effective-decision service rather than being collapsed into one enum.
- Delegated app tools currently return an empty required-permission list.
- The rich-chat system has bounded custom React block props but uses a global overwriteable component registry and executes registered components in the host React realm.
- There is no production package registration path for those custom React blocks.
- Raw HTML/CSS chat blocks do not exist.
- MCP resource data is present, but tool/resource/result metadata required by MCP Apps is dropped in several conversions, and the client does not negotiate `io.modelcontextprotocol/ui`.

### 4.6 Original app discovery, pinning, and branding gaps and implemented response

At the audit baseline, `main` already had a conversation-side Mini Apps launcher with search, open tabs, and a TODO to separate Pinned, Core, and Installed apps. The desktop channel header still opened that surface with the generic `PanelRightIcon`, which communicated panel layout rather than apps. The live desktop rail was `WorkspaceNavRail` in `new-sidebar.tsx`; the older `workspace-rail.tsx` was effectively a Storybook-only reference. The active rail rendered one core list ending in Tasks, then a flexible spacer and Settings, so the insertion point was unambiguous.

The original PR #5881 snapshot added `MiniappWorkspaceRailSurfaces` after the built-in workspace navigation, rendered every registered workspace-left surface directly as the same `AppWindow` icon, and did not yet add the requested separator, Apps selector, pin state, per-user ordering, workspace-versus-channel eligibility, unavailable-state handling, or rail overflow behavior.

At that baseline there was no canonical pin model. Installed-app reads were global rather than workspace-scoped, `ChatLayout` offered every `showInWorkspace` app to every channel after only device-capability filtering, and the existing `panel-store` owned conversation tab/layout state rather than durable user preference. Those paths were explicitly rejected as a second source of truth for package availability or pins.

The current implementation tranche closes that pin/navigation gap with Chat API-owned per-user workspace and exact-channel scopes, independent cache reads, immutable installation/contribution identity, rank/revision CAS, a separator and host Apps selector, bounded direct pins, Pinned/Available/Unavailable groups, canonical room authorization, and verified PNG/SVG rendering. The remaining UX and control-plane boundaries are recorded in Sections 19.1, 19.5, and 19.6.

At the original baseline, branding was fragmented:

- The legacy app manifest has one optional arbitrary Lucide icon name, copied into `AppInfo` and resolved by duplicated host-side allowlists with `Package` as the fallback.
- PR #5881 adds another top-level Lucide-compatible `icon` string to `manifest.tap.json`, while its executable SDK config also gives each UI entry an optional `icon` string. The platform's `MiniAppUiSurface` projection omits that field, so the contribution icon is silently discarded before UI rendering; every workspace rail surface receives the generic `AppWindow` icon and settings prints the package icon name as text.
- PR #5881 reference-only collection manifests cannot declare a name, publisher, icon, or other collection brand.
- At the original baseline, `tap-miniapps` used per-surface strings (`gamepad`
  and `code`) and its package/root collection manifests had no branding assets.
  The current fixtures instead publish digest/SRI-locked PNG/passive-SVG roles.
- The legacy Marketplace catalog stores only publisher display text plus a single app icon string. It has no immutable publisher identity/logo relationship.
- PR #3891 adds publisher approval/workspace identity but no typed publisher-logo or package-artwork contract; approval UI still uses generic host icons.
- Zephyr Cloud's organization schema exposes `logoUrl`, but the inspected update path does not currently persist/return it end to end: the form omits it from its submit payload and the API response sets it to `undefined`.
- TAP workspace avatars live in workspace profile settings and are rendered as the workspace identity. They are not verified Marketplace publisher logos and must not be promoted into that role automatically.

At the original PR/main baseline there was therefore no canonical answer for
package icon versus contribution icon versus publisher organization logo. The
current descriptor response and its still-deferred verified-profile boundary
are recorded in Sections 5.8, 19.4, and 19.6.

## 5. Canonical package architecture

### 5.1 Identity and namespaces

Every package has:

- Immutable internal package ID.
- Immutable publisher ID.
- Immutable, registry-reserved public namespace.
- Human-readable display name and slug, which may change.
- Immutable release ID and content digest.
- Installation ID scoped to the user/workspace installation.

Host events use the reserved `tap.*` namespace. Package events use:

```text
tap-pkg.<reserved-package-namespace>.*
```

For example:

```ts
tap.events.publish('branch.created', payload);
```

is delivered as:

```text
tap-pkg.planetscale.branch.created
```

`planetscale` in this example is an immutable reserved namespace, not a mutable display slug. The event envelope also carries the immutable package, release, installation, contribution, and mount identities.

A manually sourced or otherwise unattested package cannot impersonate a reserved namespace and is rewritten to a quarantined namespace such as the following. A future Marketplace signature/listing attestation may prove reserved-namespace ownership, but that authenticity layer is not implemented by the current digest/SRI lock:

```text
tap-pkg.untrusted.<content-digest>.*
```

Collections may own declared subnamespaces, but a parent cannot publish under an independently owned child namespace.

### 5.2 Static descriptor and graph lock

The host must be able to inspect the package before executing `remoteEntry` or
any exposed factory. The validated static descriptor and digest/SRI graph lock
include the fields below. Marketplace distribution must additionally bind
these exact bytes to a verified publisher/listing-release signature. That
signature is an external attestation over canonical descriptor/lock bytes, not
a field in the implemented `TapPackageDescriptorV1`:

- Identity, version, publisher and namespace claims, and content digests.
- Target-specific remote entries and exposes.
- Parent/child package relationships and dependency selectors.
- Contribution declarations and kind-specific options.
- SDK and host compatibility.
- Event declarations and schemas.
- Permission catalogs, role recommendations, runtime effects, and consent requirements.
- Required credentials/settings without secret values.
- Assets, schemas, migrations, and lifecycle/checkpoint policies.
- Marketplace presentation metadata and licensing references.

Resolution produces an immutable graph lock containing exact release IDs, remote entries, exposes, dependency edges, integrity hashes, targets, and selected variants. All runtime requests must match that lock.

### 5.3 Contribution model

Keep these axes independent:

```text
contribution kind x execution runtime x target x placement x scope/lifecycle
```

For example, `ui.surface` is a contribution kind, `desktop` is a target, `webview` is a runtime, and `workspace-left` is a placement.

`ui.surface` placements must cover panels, sidebars, routes, settings pages, dialogs, and standalone windows. `action.command` options cover command-palette items, menus, context actions, slash commands, shortcuts, and typed protocol/deep-link handlers where a separately approved host route exists.

The initial discriminated contribution union should cover:

| Family                | Contribution kinds                                                                                  |
| --------------------- | --------------------------------------------------------------------------------------------------- |
| UI and chat           | `ui.surface`, `ui.renderer`, `chat.block`, `action.command`                                         |
| Agentic               | `prompt`, `skill`, `tool`, `specialist`                                                             |
| Tasks                 | `task.type`, `task.attribute`, `task.view`, `task.action`, `task.template`                          |
| Workflows             | `workflow`, `workflow.node`, `automation.trigger`                                                   |
| MCP                   | `mcp.server`, `mcp.tool`, `mcp.prompt`, `mcp.resource`, `mcp.resource-template`, `mcp.app`          |
| Product composition   | `miniapp`, `integration.connector`, `browser.extension`                                             |
| Knowledge             | `knowledge.plot-template`, `knowledge.source-provider`, `knowledge.enricher`, `knowledge.retriever` |
| Providers and content | `provider.adapter`, `template`                                                                      |

MCP tools reuse the generic `tool` execution/permission contract while retaining MCP server/provenance/catalog metadata; MCP resources, prompts, and resource templates remain separately discoverable contributions. Specialist collections/teams and remote A2A agents should be specialist subtypes unless implementation proves they need a distinct lifecycle.

Background entries, workers, initialization callbacks, assets, schemas, migrations, permissions, settings, and credential requirements are package/runtime support descriptors. They are not automatically standalone Marketplace kinds, although `permission.catalog` is a first-class validated contribution because other modules reference its stable action IDs.

A mutable task, workflow run, or Knowledge Garden plot is scoped runtime data, not executable package state. Packages contribute task types/templates, workflow definitions/nodes, and immutable plot templates/seed snapshots that materialize host-owned records during an authorized install/action.

The descriptor must use a strict discriminated union:

```ts
type Contribution =
  | ContributionBase<'ui.surface', UiSurfaceOptions>
  | ContributionBase<'chat.block', ChatBlockOptions>
  | ContributionBase<'tool', ToolOptions>
  | ContributionBase<'permission.catalog', PermissionCatalogOptions>
  | ContributionBase<'task.type', TaskTypeOptions>
  | ContributionBase<'task.attribute', TaskAttributeOptions>
  | ContributionBase<'workflow.node', WorkflowNodeOptions>
  | ContributionBase<'mcp.server', McpServerOptions>
  | ContributionBase<'mcp.app', McpAppOptions>;
```

Policy-sensitive unknown fields fail validation. A publisher may use a namespaced non-authoritative metadata bag for information that does not affect execution or policy.

### 5.4 Module type options

All contributions share identity, kind, API version, target/runtime entries, dependency references, compatibility, lifecycle, events, and authorization. Options are kind-specific:

- UI: placement, context, instance policy, persistence, target exposes, sizing, navigation, and accessibility.
- Tool: input/output schemas, effect declaration, timeout, concurrency, idempotency, permissions, and actor exposure.
- Workflow node: input/output ports, outcomes, configuration schema, effects, host ports, retry, and compensation.
- Task type: attributes, states, canonical-status mappings, transitions, actions, views, and migrations.
- Task attribute: value schema, visibility, mutability, merge/index policy, renderer/editor, and migration.
- MCP server: transport, catalog expectations, credentials, scope, and supervision.
- MCP App: server/tool/resource references, protocol version, CSP/permission maxima, fallback, and lifecycle adapter.
- Browser extension: browser profiles, permissions, host access, lifecycle, and restart requirements.
- Knowledge: template/materialization policy, ownership, scope, update behavior, enrichment, and retrieval.

### 5.5 Module Federation as the executable mechanism

Each executable TAP package publishes at least one Federation-compatible remote container. A target may expose modules such as:

```text
./tap/lifecycle
./ui/desktop
./ui/mobile
./background
./tools/database
./specialists/planner
./workflows/onboarding
./workflow-nodes/approval
./chat/branch-card
```

The TAP host uses one verified Federation graph per runtime realm:

- WebView/iframe realm for UI and interactive chat blocks.
- QuickJS realm for background work and non-DOM modules.
- Worker or Node-like realm where explicitly supported.
- Workflow host/sidecar adapter for workflow and node execution.

The TAP SDK is supplied through a host-controlled share scope and capability broker. Publisher code cannot replace the host SDK or convert a version mismatch into trust.

The SDK/share contract needs a stable ABI policy:

- One host-selected compatible SDK instance per realm; publisher `singleton` claims do not override host selection.
- Exact major/API compatibility checks before executing an expose.
- Generated SDK capability negotiation so older targets degrade deliberately.
- No ambient host objects, Node built-ins, DOM globals, credentials, or native bindings beyond declared target capabilities.
- A failed SDK/share resolution aborts activation rather than loading a second privileged SDK copy.

QuickJS now uses a target-specific locked ESM/remote-entry loader, one module
cache and Federation container per exact release, bounded graph evaluation,
CPU/memory/result quotas, structured JSON boundaries, lifecycle dispatch, and
the host SDK/tool bridge. The Node/SSR support pattern in Federation confirms
that a DOM is not fundamental to the container protocol. What remains is
general background execution—timers, host futures, network/filesystem
capabilities, and any additional SDK services—rather than another package
loader.

Use `loaded-first` sharing unless a specific package contract requires otherwise. A `version-first` strategy may evaluate every remote entry during sharing initialization and is undesirable for untrusted or lazily used contributions.

Zephyr delivery must serve ESM entries and chunks with correct JavaScript MIME types, immutable caching, integrity metadata, and target-appropriate CORS/CSP. Dynamic imports, workers, source maps, and nested chunks must resolve only within the locked release graph. A valid Node/SSR container does not make its code QuickJS-safe; each target entry must avoid unsupported globals and pass target-specific conformance.

### 5.6 Package source pipeline

All source adapters implement these phases:

1. Normalize the source locator.
2. Fetch/copy without executing package code.
3. Safely extract archives with file-count, path, size, and compression-ratio limits.
4. Find and validate the static descriptor.
5. Resolve publisher identity/signatures and trust presentation.
6. Resolve dependencies and create an immutable graph lock.
7. Verify every asset and entry hash.
8. Compute permission, effect, entitlement, and target compatibility diffs.
9. Stage into content-addressed storage.
10. Commit the installation atomically only after approval.

Source-specific requirements include:

- **Bundled repository:** descriptor and assets are produced by the product build, but still pass schema/expose/runtime consistency checks.
- **npm:** verify registry provenance plus tarball integrity, reject lifecycle-script execution during acquisition, and lock the exact package version/integrity.
- **GitHub:** resolve a tag/branch selector to an immutable commit, verify the fetched tree/archive, and never execute repository setup hooks while inspecting it.
- **Zip:** reject traversal, absolute paths, symlink/hardlink escapes, device files, duplicate normalized paths, file-count/size/compression-ratio abuse, and unexpected executables.
- **Local directory:** hash a bounded allowlisted tree, exclude secrets/build caches by policy, watch safely, and regenerate an immutable development snapshot for each accepted build.
- **Zephyr:** resolve an application/tag/channel to an immutable snapshot and verified artifact graph before TAP sees a candidate release.

All manually sourced packages remain visibly **Untrusted** unless installed through the official Marketplace approval path. A valid publisher signature may preserve a reserved namespace and provenance while the install remains untrusted in TAP's official-status UI.

Packages should also support optional SBOM, vulnerability/malware scan, and reproducible-build attestations. These enrich review and policy; they do not replace signatures, hashes, sandboxing, or runtime authorization.

Development directories may use a local watcher, but they still need a generated descriptor, bounded file access, namespace quarantine unless signed, and explicit development grants.

### 5.7 App discovery, navigation, and pinning

The host owns app discovery and pin state. A package may declare where a contribution is eligible to appear and whether it is pinnable, but package code cannot insert itself into host chrome, force a pin, choose its order, or turn a channel-only contribution into a workspace route.

#### Workspace rail

The desktop workspace rail order is:

```text
built-in navigation through Tasks
horizontal separator
Apps selector
eligible workspace/global pinned app contributions
flexible overflow space
host utility/settings controls
```

The Apps selector opens the workspace app library. It lists enabled installed contributions in Pinned, Available, Core, and Unavailable sections, preserves a visible trust/entitlement state, and offers a capability-gated link to the Marketplace for acquiring more apps. Selecting a workspace/global app opens its default workspace surface. Channel-only contributions may be discoverable in a clearly separate Channel Apps section, but they require a channel context and offer only channel-management/channel-selector pin actions. A pinned item is only a shortcut to that same contribution; pinning does not activate background work, grant permissions, widen scope, or change entitlement.

Only a contribution whose host-validated placement includes a workspace/global launch surface is eligible for the workspace rail. Eligibility is evaluated per contribution, not per package. A package that exposes both workspace and channel surfaces may therefore have one workspace contribution on the rail while its separate channel contribution remains channel-scoped.

The Apps selector is always reachable when the workspace supports apps, including empty/error states. Pinned icons appear below it in user-defined order. The pinned region must be bounded and scrollable or collapse excess items into an overflow affordance so Settings remains reachable at every supported height and UI scale. Drag reorder, keyboard reorder, unpin, tooltip, active state, unread/status badges, and accessible labels use host components and declared event data.

#### Channel Apps selector

The generic side-panel button shown in the channel heading becomes the channel **Apps** button. Use the Lucide `Blocks` glyph represented by the second supplied icon as the recommended default: it conveys a collection of app surfaces. Reserve `Puzzle` for extensions/integrations, where TAP already uses it for Chrome extensions. The current `PanelRightIcon` remains appropriate for a generic panel-layout control but is not the right semantic label for this app launcher.

Clicking the channel Apps button opens/closes the existing conversation-side Mini Apps selector. The selector shows, in order:

1. Apps pinned for this user in this channel.
2. Other apps enabled for this channel/workspace and compatible with the current target.
3. Temporarily unavailable pinned apps with an actionable reason when safe to reveal.
4. A capability-gated path to channel app management or the Marketplace.

Channel-specific apps may be pinned inside that selector, but never become global workspace-rail icons unless they separately expose an eligible workspace/global contribution. A channel pin in channel A must not appear in channel B. An app exposed in both placements has independent workspace and per-channel pins.

The Apps button is host chrome, so it always uses the host `Blocks` glyph rather than a publisher logo. When the side panel is open it receives the normal active state. A count or activity badge may be shown only from host-authorized declared app events; arbitrary package CSS cannot decorate the header.

#### Canonical pin state

Pin records refer to stable installations and contributions, never mutable display names, URLs, tags, or release IDs:

```ts
interface MiniAppPin {
  pinId: string;
  subjectUserId: string;
  workspaceId: string;
  location: { kind: 'workspace-rail' } | { kind: 'channel-app-selector'; channelId: string };
  installationId: string;
  contributionId: string;
  rank: string;
  createdAt: string;
  updatedAt: string;
}
```

Pins are synchronized user preference records and therefore belong in TanStack Query-backed server state, not a Zustand mirror. Open/closed selector state may remain local UI state. Workspace administrators may publish a separate recommended/default app set; that policy must not silently masquerade as a user's pin. Publisher recommendations are metadata only.

Every pin read and mutation is filtered by current membership, target compatibility, installation scope, channel access, visibility, entitlement, and contribution availability. A temporarily incompatible/offline/quarantined app retains its preference but is not launchable. Uninstall confirms and removes its pins transactionally; reinstalling a different package with the same display slug does not inherit them.

Launching a pin creates or resumes the contribution's normal lifecycle mount. Closing a view follows pre-pause/unmount policy; unpinning only removes navigation state and must not uninstall the package or terminate unrelated background contributions.

Recommended desktop route identity is installation plus contribution, for example `/workspace/$workspaceId/apps/$installationId/$contributionId`; the existing PR route based on mutable mini-app/surface labels should be migrated or proven to resolve those labels through immutable IDs. Mobile uses the same selector model in a sheet/tab surface even though it has no desktop left rail.

#### Navigation acceptance anchors

Add stable product-side anchors for at least the rail separator, Apps selector, each pinned contribution, channel Apps toggle, channel pinned section, pin/unpin action, reorder action, unavailable reason, and Marketplace link. Use the existing `<surface>-<component>-<role>` naming convention and keep E2E selectors independent of app display names.

### 5.8 Branding and visual asset identity

Brand ownership is deliberately split:

| Visual identity                              | Canonical owner                   | Where it is declared                                                              |
| -------------------------------------------- | --------------------------------- | --------------------------------------------------------------------------------- |
| Host Apps selector glyph                     | TAP product                       | Host design system (`Blocks` by default), never package metadata                  |
| Publisher/organization logo                  | Verified publisher organization   | Zephyr/Marketplace organization profile and immutable publisher ID                |
| Parent collection icon/logo                  | Parent package release            | Validated, digest/SRI-locked TAP package descriptor; future Marketplace signature |
| Mini-app/package icon/logo                   | Package release                   | Validated, digest/SRI-locked TAP package descriptor; future Marketplace signature |
| Contribution icon                            | Individual validated contribution | Contribution `presentation` metadata, falling back to package icon                |
| Specialist/tool/workflow/node/chat/plot icon | Corresponding contribution        | That contribution's validated presentation metadata                               |
| TAP workspace icon                           | TAP workspace owner/admin         | Existing workspace profile settings; never controlled by a package                |
| In-app content imagery                       | Package/content data              | Declared package assets or authorized runtime content, not navigation identity    |

The package descriptor replaces ambiguous icon strings with a typed, ordered,
digest/SRI-locked presentation asset table. Marketplace distribution must add
publisher/listing-release authenticity over the same bytes. The current
implementation shape is:

```yaml
package:
  publisherId: pub_01H...
  organizationId: org_01H...
presentation:
  name: PlanetScale
  description: Database tooling and operational workflows
  iconAssets:
    - assets/icon-light.svg
    - assets/icon-dark.svg
    - assets/icon.png
  assets:
    - role: app-icon
      path: assets/icon-light.svg
      mediaType: image/svg+xml
      integrity: sha256-...
      sizes: [any]
      theme: light
    - role: app-icon
      path: assets/icon-dark.svg
      mediaType: image/svg+xml
      integrity: sha256-...
      sizes: [any]
      theme: dark
    - role: app-icon
      path: assets/icon.png
      mediaType: image/png
      integrity: sha256-...
      sizes: [256x256]
      theme: any
    - role: publisher-icon
      path: assets/publisher.png
      mediaType: image/png
      integrity: sha256-...
      sizes: [128x128]
      theme: any
    - role: organization-icon
      path: assets/organization.svg
      mediaType: image/svg+xml
      integrity: sha256-...
      sizes: [any]
      theme: any
    - role: wordmark
      path: assets/wordmark-light.svg
      mediaType: image/svg+xml
      integrity: sha256-...
      sizes: [512x128]
      theme: light
contributions:
  - id: database-console
    kind: ui.surface
    options:
      placement: workspace-left
      scope: workspace
      iconAssets:
        - assets/icon-light.svg
        - assets/icon-dark.svg
        - assets/icon.png
```

Every projected package surface carries two host-verified candidate lists:

- `packageIconAssets` is the ordered parent-package set selected by
  `presentation.iconAssets`. An omitted/empty package selection inherits every
  `app-icon` only for backwards compatibility.
- `surfaceIconAssets` is the ordered subset selected by
  `ui.surface.options.iconAssets`.
- An omitted or empty surface `iconAssets` selection inherits the parent
  package selection; it does not mean “force fallback.” Child surface artwork
  therefore cannot silently replace a collection's parent icon.
- Each projected candidate retains `assetUrl`, `mediaType`, `sizes`, and
  `theme`. The host chooses one at render time without discarding the other
  candidates from package state.

`app-icon`, `publisher-icon`, `organization-icon`, `marketplace-card`, and
`wordmark` are distinct validated, locked roles. Only `app-icon` candidates currently
drive package/surface launcher rendering. A package-supplied `publisher-icon`
or `organization-icon` is a digest/SRI-locked release presentation claim or historical
snapshot, not proof of Marketplace publisher identity; verified publisher
branding still resolves through the external publisher-profile binding.

Package, collection, and contribution icons accept both PNG (`image/png`) and
SVG (`image/svg+xml`) assets. Either format may be a selected candidate, and
variants may mix formats—for example, a full-color PNG launcher icon with a
scalable SVG contribution icon. Authors reference a package-relative asset. The
current build/install contract retains byte length and integrity in the asset
lock and media type, declared size, theme, path, and SRI in the descriptor; a
future registry normalization may additionally assign immutable asset IDs. A
custom PNG or SVG is first-class and does not require choosing a Lucide icon.

The current schema uses package-relative paths plus SRI; a future normalized
registry form may replace repeated paths with stable asset IDs while retaining
the exact ordered candidate semantics. At minimum the contract supports square
full-color PNG or SVG icons, multiple fixed raster sizes, scalable SVGs,
light/dark variants, horizontal wordmarks, accessible display text, and
Marketplace cards/screenshots. Monochrome and maskable selection require a
future typed asset-purpose enum plus host mask/tint and safe-zone consumers;
they are not inferred from SVG content, filenames, theme, or size and are not
claimed by the current renderer. Any
background/surface hint is a controlled host enum, never an arbitrary Tailwind
class or CSS value. A generated allowlisted `systemIcon` union remains useful
as an optional convenience for first-party/simple contributions and as a
fallback, but an arbitrary Lucide string is not the brand contract.

Selection is deterministic and host-owned. First restrict candidates to the
effective light/dark theme when an exact-theme candidate exists; otherwise use
`theme: any`. Compute target pixels as the rendered CSS size multiplied by the
current device-pixel ratio. Prefer an exact fixed raster size, then a scalable
`any` candidate, then the nearest larger raster, then the nearest smaller
raster, with descriptor order as the final tie-breaker. Theme-class and DPR
changes re-evaluate the same immutable candidate lists.

Fallback is deterministic: contribution icon, then active package-release icon, then a host-generated monogram/system fallback. The publisher logo is displayed separately with publisher identity/verification and is not silently substituted as the app icon. Parent and child packages retain independent icons just as they retain independent identities and entitlements.

Publisher identity cannot be self-asserted by package metadata. The descriptor carries immutable `publisherId`; Marketplace resolves the current verified organization profile. A manually sourced package may show its digest-locked publisher claim and source provenance, but it cannot borrow a Marketplace organization logo or verification badge without a verified identity binding and future publisher/listing attestation.

Package/release assets are immutable and content-addressed. Zephyr publishing and Marketplace ingestion validate decoded content/file signatures rather than trusting filename extensions, then validate media type, dimensions, decoded pixel limits, byte/decompression limits, hashes, transparency/contrast variants, and animation policy. PNG handling must fully decode the image, reject malformed/polyglot payloads, bound metadata and pixel count, and normalize or strip unsafe/unneeded metadata. SVG handling must reject scripts, event handlers, `foreignObject`, external URLs/resources/fonts, navigation, and active/animated content before producing a sanitized asset or rasterized host-cache variant. Untrusted SVG is never injected as host DOM; render it only as an isolated image from the content-addressed asset origin under restrictive CSP or use the safe rasterized form. Do not fetch arbitrary third-party logo URLs at render time, leak workspace referrers/cookies, or allow an image asset to execute script.

The publisher organization logo may evolve independently of a package release, but each uploaded profile asset is versioned and audited. Marketplace cards can show the current verified publisher logo while release history retains the publisher ID and optional presentation snapshot used at publication. An app icon changes only when a newly verified package release becomes active.

### 5.9 Portable package asset origins

Package WebView assets must not depend on a Tauri custom URI scheme. The
original `http://<id>.<id>.tap-miniapp.localhost/...` projection is an ordinary
HTTP URL and does not reliably match the registered custom-protocol handlers;
on iOS the custom-scheme alternative also produces an opaque JavaScript origin.
That is unsuitable for native ESM Module Federation, exact `postMessage`
checks, workers, WASM, or shared desktop/mobile behavior.

TAP therefore owns one ephemeral loopback HTTP asset broker per application
process. It binds loopback only on a random port before `IsolateState` is
constructed, injects that immutable origin configuration into the state, and
then serves only verified locked assets. Each installation/release retains a
different browser origin even though all packages share one listener:

```text
http://<base32-miniapp-id>.tap-miniapp.localhost:<ephemeral-port>/<capability>/<prefix>/<asset>
```

The 256-bit mini-app identity is encoded as one canonical lowercase,
unpadded 52-character RFC 4648 base32 DNS label. The path also carries a
per-launch unguessable capability value. The broker requires the exact
canonical `Host` and port, accepts only `GET`/`HEAD`, decodes each segment once,
rejects traversal/aliases/credentials, resolves bytes only through the active
verified package graph, bounds file size and concurrency, and never logs the
capability. Removed or superseded package graphs return 404 even if an old URL
remains in renderer memory.

Package-specific hostnames are mandatory because package frames use
`allow-same-origin`; putting every package under one fixed origin with a path
prefix would let mutually untrusted frames inspect one another. A changed
release/OTA candidate also receives a new origin. If an actual Android or iOS
WebView acceptance test proves wildcard `.localhost` resolution unusable, the
fallback is one `127.0.0.1` port per active package/release, with strict realm
and file-descriptor quotas. That fallback is not the default because it is
more expensive and cookies do not isolate by port.

The generated `tap.surface.mjs` derives a read-only
`packageAssetBaseUrl` from the descriptor-selected, same-origin remote-entry
directory and freezes it into the surface mount context. The SDK resolves only
raw canonical relative paths beneath that directory. Build output is scanned
for `file://` URLs and absolute checkout paths so Rspack cannot silently fold a
developer-machine `import.meta.url` into a published package. Current
multi-target packages use `targets/<target>/remoteEntry.mjs` and keep
target-specific compatibility assets below the same target directory.

HTTP response policy remains media-aware:

- HTML navigation and validated PNG/passive-SVG images use
  `Cross-Origin-Resource-Policy: cross-origin` because the TAP parent must frame
  or render them.
- JS, CSS, JSON, WASM, fonts, and other executable/internal assets retain
  `Cross-Origin-Resource-Policy: same-origin`.
- No package response grants CORS. HTML CSP uses the exact current TAP parent
  in `frame-ancestors`, never `*`; error responses use `frame-ancestors
'none'`. `document-domain=()` and `Origin-Agent-Cluster: ?1` prevent sibling
  origins from weakening isolation.

Android uses a narrow network-security exception for
`tap-miniapp.localhost` and its subdomains while global cleartext remains
disabled. Apple configuration uses a narrow ATS domain exception plus
`NSAllowsLocalNetworking`, not arbitrary WebContent loads. Both configurations
must be authored in their generators, not patched only in generated files.
The random port intentionally changes browser storage origins across launches;
durable package state therefore goes through the host SDK and lifecycle
checkpoint broker rather than relying on `localStorage` or IndexedDB.

## 6. Lifecycle and update architecture

### 6.1 TAP state model

Separate installation, realm activation, contribution activation, and UI mount state:

```text
resolved
  -> verified
  -> staged
  -> installed
  -> initializing
  -> active
  -> mounted (zero or more mount instances)
  -> pausing
  -> paused
  -> resuming
  -> active
  -> updating
  -> deactivating
  -> uninstalling
  -> uninstalled
```

A package may be active without a UI mount because tools, events, workflows, or background work remain available. Every mount has a distinct `mountId`, context, placement, target, visibility, and authorization session.

Installation may commit before package code has ever executed. `tap.lifecycle.installed` is therefore an authoritative host/audit event, not a callback that package code must observe in real time; the first activation receives the current installation snapshot.

Uninstall is ordered deliberately:

1. Stop new ordinary calls and move to `uninstalling`.
2. Run bounded `prePause`/checkpoint and `beforeUninstall` while code, approved cleanup capabilities, and owned storage still exist.
3. Unmount/deactivate contributions, cancel work, revoke subscriptions/capability handles/grants, and destroy realms.
4. Apply the declared data-retention/export/delete policy and release CAS references.
5. Commit `uninstalled` and emit it to TAP, dependents, and audit consumers. Removed package code cannot be expected to receive its own post-uninstall event.

### 6.2 Existing Federation hooks versus TAP authority

| TAP phase    | Federation participation                | TAP-owned responsibility                                                 |
| ------------ | --------------------------------------- | ------------------------------------------------------------------------ |
| Resolve      | None authoritative                      | Source/Marketplace resolution, trust, entitlement, graph lock            |
| Install      | None                                    | Persistent installation, scope, grants, update policy                    |
| Stage        | Optional verified preload               | Download, hash/signature verification, safe extraction, CAS transaction  |
| Realm init   | `beforeInit`, `init`, share hooks       | Runtime creation, SDK/capability binding, immutable remote graph         |
| Activate     | Entry/init/get/factory hooks            | Export validation, explicit `activate()`, health and timeout             |
| Mount        | Bridge render hooks as instrumentation  | Mount identity, placement/context, render success, capability session    |
| Pause/resume | New TAP lifecycle hook group            | Checkpoint, context refresh, capability/event suspension and restoration |
| Update       | Normal hooks in a fresh candidate realm | Migration, health check, atomic swap, rollback                           |
| Unmount      | Bridge destroy as instrumentation       | Awaited pre-unmount, mount cleanup, handle revocation                    |
| Uninstall    | None authoritative                      | Deactivate, revoke, retention policy, delete installation and cache refs |

Authorization must happen before `loadRemote`; `beforeInitRemote` runs after the remote entry has already loaded.

### 6.3 Federation application lifecycle extension

The current `PluginSystem` cannot register arbitrary plugin hook names. Add a seventh typed hook group to Module Federation core, or an equivalent first-class extension registry created before runtime plugins are applied:

```ts
interface ApplicationLifecycleHooks {
  prePause(context: PauseTransitionContext): Promise<void | LifecycleDecision>;
  pause(event: PauseCommittedEvent): Promise<void>;
  preResume(context: ResumeTransitionContext): Promise<void | LifecycleDecision>;
  resume(event: ResumeCommittedEvent): Promise<void>;
  lifecycleError(event: LifecycleTransitionError): Promise<void>;
}
```

Only trusted host plugins participate in Federation runtime hooks. Untrusted packages expose a bounded module:

```ts
interface TapMiniAppLifecycleV1 {
  prePause?(context: TapPrePauseContext): Promise<void>;
  pause?(context: TapPauseContext): Promise<void>;
  preResume?(context: TapPreResumeContext): Promise<void>;
  resume?(context: TapResumeContext): Promise<void>;
}
```

The trusted TAP supervisor invokes it through `./tap/lifecycle`.

### 6.4 Pre-pause and pause

Pause is one serialized transaction:

1. Acquire the lifecycle-instance transition lock.
2. Move `active -> pausing` and close normal tool/event ingress.
3. Run trusted Federation `prePause` policy hooks.
4. Invoke package `prePause` in reverse dependency order.
5. Allow a bounded checkpoint/flush through a lifecycle-only storage lane.
6. Drain or cancel work according to declared effect/idempotency policy.
7. Invoke package `pause` as its final control callback.
8. Freeze timers/background dispatch, revoke capability handles, and hide/detach UI as appropriate.
9. Atomically store paused state, lifecycle epoch, and checkpoint reference.
10. Emit the committed Federation hook and `tap.lifecycle.paused` event.

`prePause` is best-effort. Crashes, OS eviction, process termination, and power loss mean important state must be persisted continuously. Package callbacks cannot veto security revocation, shutdown, update rollback, uninstall, or resource eviction. A voluntary pause may accept a short host-capped delay request.

### 6.5 Pre-resume and resume

Resume is also serialized:

1. Move `paused -> resuming`; open only the lifecycle/control lane.
2. Revalidate installation, release, entitlement, grants, permissions, and workspace/channel membership.
3. Load and validate the checkpoint; migrate it when the candidate release differs.
4. Resolve fresh workspace/channel/conversation, theme, locale, connectivity, SDK, event, and permission context.
5. Run trusted Federation `preResume` hooks.
6. Invoke package `preResume` with a read-only context and checkpoint reader.
7. Recreate subscriptions and mount bindings; mint new capability handles at the current authorization epoch.
8. Invoke package `resume`, run health checks, and atomically commit `active`.
9. Emit the committed Federation hook and `tap.lifecycle.resumed` event.

First activation is not resume. The complete lifecycle family should also include `preActivate/activate`, `preMount/mount`, `preUnmount/unmount`, `preDeactivate/deactivate`, `prepareUpdate/migrate/healthCheck`, and `beforeUninstall`, sharing the same context/checkpoint infrastructure.

Lifecycle scope is explicit: installation, realm, contribution, or mount. Pausing a virtualized chat block must not automatically pause the package background worker or another visible mount.

Every transition carries a unique transition ID, monotonic lifecycle epoch, reason, force flag, deadline, and cancellation signal.

### 6.6 Updates and rollback

For pinned, next-launch, OTA, and follow-tag updates:

1. Resolve and stage a complete immutable candidate graph.
2. Compute compatibility, permissions, effects, entitlements, and migration diffs.
3. Pause/checkpoint the old realm when activation is allowed.
4. Create a fresh Federation instance/QuickJS/WebView realm qualified by installation and release IDs.
5. Load and validate all required exposes.
6. Run lifecycle migration/pre-resume and health checks.
7. Atomically switch the active-release and mount-routing pointers.
8. Keep the old realm paused during a rollback window.
9. Destroy it only after the candidate is stable.

Never mutate a loaded realm in place with forced remote replacement. Permission expansion, new specialist eligibility, wider scope, reduced consent, new runtime effects, or increased autonomy blocks automatic activation and keeps the last approved release active.

## 7. Namespaced events

### 7.1 Declaration

The validated, immutable descriptor declares every published and consumed event:

```yaml
events:
  publishes:
    - name: branch.created
      schema: ./schemas/branch-created.v1.json
      visibility: workspace
      delivery: ephemeral
  subscribes:
    - event: tap.task.updated
      versions: [1]
    - dependency: database-core
      event: branch.deleted
      versions: [1]
```

Dependency aliases resolve through the immutable graph lock. Packages cannot subscribe to arbitrary workspace-wide wildcards or publish `tap.*` events.

### 7.2 Event envelope

The host stamps all authority fields:

```ts
interface TapEvent<T> {
  eventId: string;
  topic: string;
  schemaVersion: number;
  occurredAt: string;
  sequence: number;
  lifecycleEpoch: number;

  packageId?: string;
  releaseId?: string;
  installationId: string;
  contributionId?: string;
  mountId?: string;

  scope: {
    workspaceId: string;
    channelId?: string;
    conversationId?: string;
    projectId?: string;
    taskId?: string;
  };

  correlationId?: string;
  causationId?: string;
  payload: T;
}
```

Publishers cannot set package identity, installation identity, scope authority, timestamps, ordering, or lifecycle epochs.

### 7.3 Delivery and security

- Ephemeral, at-most-once, ordered per installation/realm by default.
- Never promise exactly-once delivery.
- Durable business state is persisted first; events are notifications/invalidation.
- Durable/replayable events require an explicit outbox contract.
- Payload size, rate, queue, and recursion limits apply.
- Backpressure may drop or coalesce declared low-value events.
- No credentials, secrets, raw private content, or unauthorized scope IDs in envelopes.
- Delivery is filtered against current workspace/channel/conversation/resource authority.
- Cross-package subscriptions require a declared dependency or public event plus a grant.
- A paused contribution receives only the lifecycle/control lane. Resume supplies fresh state/context rather than an unbounded replay.

Initial host event families include:

```text
tap.lifecycle.*
tap.context.*
tap.theme.*
tap.connectivity.*
tap.authorization.*
tap.task.*
tap.workflow.*
tap.update.*
tap.chat.block.*
```

The lifecycle family must provide concrete, versioned events for at least `tap.lifecycle.installed`, `tap.lifecycle.activated`, `tap.lifecycle.mount.created`, `tap.lifecycle.mount.context-changed`, `tap.lifecycle.mount.visibility-changed`, `tap.lifecycle.paused`, `tap.lifecycle.resumed`, `tap.lifecycle.mount.destroyed`, `tap.lifecycle.deactivated`, `tap.lifecycle.update.staged`, `tap.lifecycle.update.activated`, `tap.lifecycle.update.failed`, `tap.lifecycle.uninstalling`, and `tap.lifecycle.uninstalled`. These are host-stamped observations of committed transitions; the corresponding pre/post callbacks and Federation runtime hooks remain the ordered control mechanism.

## 8. Permissions, roles, levels, humans, specialists, and other actors

### 8.1 Validated permission catalog and Marketplace signing

Packages expose possible actions and package-local levels. TAP alone grants them:

```yaml
- kind: permission.catalog
  id: invoice-permissions
  options:
    resources:
      - id: invoice
        scopes: [workspace, channel, resource]
    actions:
      - id: invoice.view
        resource: invoice
        actorEligibility:
          direct: [human]
          delegated: [specialist]
        specialistAuthority: borrowed-human
        autonomyCeiling: listen
        consent: none
        risk: read
      - id: invoice.approve
        resource: invoice
        actorEligibility:
          direct: [human]
          delegated: []
        specialistAuthority: none
        consent: fresh-decision
        risk: consequential
    levels:
      - id: viewer
        actions: [invoice.view]
      - id: approver
        includes: [viewer]
        actions: [invoice.approve]
    roleRecommendations:
      - workspaceRole: view_only
        level: viewer
      - workspaceRole: admin
        level: approver
```

Actions and levels become immutable namespaced IDs such as `tap-pkg.planetscale.invoice.view` and `tap-pkg.planetscale.level.viewer`.

### 8.2 Keep authorization axes separate

Do not collapse these into one numeric “permission level”:

1. Workspace/channel role.
2. Granular action.
3. Package-local level/profile.
4. Actor eligibility.
5. Specialist autonomy (`listen`, `plan`, `do`).
6. Consent lifetime (`deny`, once, channel, reusable, fresh decision).
7. Runtime capability/effect.
8. Paid entitlement.

Package levels use an explicit acyclic `includes` graph rather than numeric comparison. Role recommendations are suggestions reviewed by workspace policy; an untrusted package cannot install allow rules.

Human-only means a specialist executor is rejected even when a human initiated or approved the operation. Human-and-specialist means a specialist may request execution under an explicit authority mode; it does not grant every specialist independent authority.

Intentional specialist-only operations are representable with `direct: []` and `delegated: [specialist]`; a verified human/workspace authority chain or expiring service lease still authorizes them. Normalize the current `viewer` versus `view_only` vocabulary and unknown-role fail-closed behavior before packages may bind recommendations to host roles.

### 8.3 Effective authority

```text
human effective authority =
  canonical role/group/resource policy
  intersect installation grants
  intersect package action/scope declaration
  intersect organization policy and consent
  gated by runtime effects and entitlement

specialist effective authority =
  represented human effective authority (when borrowed)
  intersect specialist-specific grants
  intersect specialist manifest/tool allowlist
  intersect package actor eligibility
  intersect delegation-chain ceiling
  intersect autonomy, scope, consent, and runtime admission
```

A specialist retains specialist identity, version, turn ID, and `onBehalfOf` chain. It never becomes an `admin` because the represented human is an admin. Every specialist-to-specialist hop can only narrow permission, resource scope, autonomy, consent, expiration, delegation depth, tools, and effects.

Autonomous background execution uses an explicit expiring workspace/installation authority lease, not an ambient human role.

### 8.4 Independent gates and SDK

Every protected operation checks independently:

- Domain action authorization.
- Runtime capabilities/effects, such as network, files, browser control, command execution, media, or spend.
- License/entitlement.

Tools, workflow nodes, task transitions, UI commands, chat actions, MCP calls, and protected subscriptions bind to action IDs and runtime effects. The host reauthorizes immediately before side effects; hiding UI is not enforcement.

The runtime context preserves initiator, executor, and authority chain separately and contains an authorization epoch and expiration. Revocation increments the epoch, invalidates handles, stops new work, and causes future calls to fail closed.

Scoped host events include `tap.authorization.catalog.changed`, `tap.authorization.grant.changed`, `tap.authorization.effective.changed`, `tap.authorization.revoked`, `tap.authorization.consent.requested`, and `tap.authorization.consent.decided`. They never disclose private policy details or hidden resource identities to unauthorized listeners.

## 9. Tasks

### 9.1 Reconcile the base task contract first

Task extension cannot safely land until TypeScript, Rust, CRDT, specialist tools, and workflow paths use one generated canonical task contract and authority envelope.

Current status values/defaults drift across implementations (`in-progress`, `inProgress`, `InProgress`, and `in_progress`; default `todo` versus `backlog`). TAP's core security fields must remain host-owned:

- Task/workspace identity.
- Workspace, channel, conversation, and project scope.
- Effective visibility.
- Creator/provenance and borrowed authority.
- Workflow run/step/idempotency lineage.
- Updated-at and deletion/tombstone state.

### 9.2 Task contributions

Add:

- `task.type` — versioned specialization with states, attributes, transitions, defaults, actions, views, and migrations.
- `task.attribute` — reusable namespaced field schema; installing it does not globally mutate every task.
- `task.view` — board/list/detail projection or renderer.
- `task.action` — host-authorized task commands or workflow entry points.
- `task.template` — initial content/defaults.

Attribute definitions include JSON Schema, applicability, required/default behavior, field-level mutability, sensitivity/visibility, size, CRDT merge policy, indexing/filtering, renderer/editor, and migrations. Values are stored under host-qualified keys.

A task remains readable with opaque/fallback attribute presentation when its package is missing. A package cannot widen effective visibility or overwrite provenance.

Keep generic TAP board interoperability by mapping richer type states to canonical statuses:

```yaml
states:
  triage:
    canonicalStatus: backlog
  approved:
    canonicalStatus: todo
  processing:
    canonicalStatus: in-progress
  completed:
    canonicalStatus: done
```

Task events include `tap.task.created`, `tap.task.updated`, `tap.task.transitioned`, `tap.task.attributes.changed`, `tap.task.archived`, and `tap.task.deleted`. They preserve the existing effective-visibility filtering and must not reveal hidden task existence or change frequency.

## 10. Chat blocks and MCP Apps

### 10.1 `chat.block`

A mini app may expose a custom chat block as a standalone contribution or as part of a package. Supported renderer protocols:

| Protocol                | Contract                                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------ |
| `tap-primitives-v1`     | Declarative allowlisted TAP component tree; safest and mobile-friendly                                 |
| `tap-federated-view-v1` | Federation expose running inside a per-install isolated UI realm and using TAP SDK/UI components       |
| `isolated-html-v1`      | Raw HTML/CSS with optional declared JavaScript, strict CSP, isolated origin, and no network by default |
| `mcp-app-2026-01-26`    | Standards-compliant MCP App hosted through the TAP MCP Apps bridge                                     |

Never execute marketplace React remotes in TAP's host React realm. Even official third-party packages use isolation; host-realm components are TAP core only. Raw HTML is never inserted into transcript DOM with `dangerouslySetInnerHTML`.

Descriptor options include:

- Qualified block ID and payload schema/version/size limit.
- Renderer protocol and per-target expose/resource.
- Height/resize and viewport/lazy policy.
- Contentful text/markdown fallback and accessibility label.
- Declared events, actions, permissions, and effects.
- CSP/network/media/camera/microphone/clipboard maxima.
- Lifecycle/checkpoint policy.
- Supported SDK, host, renderer, and payload versions.

### 10.2 Durable block envelope

Persist data, identity, and fallback rather than mutable executable locations:

```ts
interface PackageChatBlock {
  type: 'package';
  packageId: string;
  contributionId: string;
  schemaVersion: number;
  rendererProtocol: string;
  releaseVersion: string;
  releaseDigest: string;
  payload: JsonValue;
  fallback: { format: 'text' | 'markdown'; content: string };
}
```

The fallback renders when the package is absent, uninstalled, quarantined, incompatible, not entitled, unsupported on the target, or fails schema validation. Retention policy must decide how long older renderer releases remain in content-addressed storage; message readability cannot depend solely on retaining executable code forever.

Each render gets host-stamped block instance, mount, message, conversation/channel, installation, and lifecycle identities. By default it sees its own payload and minimal context, not transcript history.

### 10.3 Chat-block SDK and events

The bounded SDK includes context, resize, events, typed actions, safe links, drafts/messages, tool calls, resource reads, and model-context updates. Every effect passes current permission, entitlement, intent, scope, and idempotency checks.

Do not route package actions through the legacy global `MessageActionRegistry`: it supports an unrestricted fallback handler and can continue when an action requires confirmation but no confirmation provider is installed. Package actions use descriptor-declared namespaced IDs, bounded schemas, server/native-issued intents, current authorization, effect policy, and idempotency at the final executor; Marketplace actions additionally require release-signature authenticity.

Package events use their normal namespace, for example `tap-pkg.planetscale.branch.selected`. Host block events use `tap.chat.block.*` and lifecycle events use `tap.lifecycle.*`.

Virtualized/hidden blocks use mount-scoped pre-pause/pause and pre-resume/resume without suspending unrelated package contributions.

### 10.4 MCP Apps

Implement the official stable MCP Apps extension rather than a TAP-specific MCP-UI dialect:

- Extension ID `io.modelcontextprotocol/ui`.
- `ui://` resources.
- MIME type `text/html;profile=mcp-app`.
- Tool linkage through `_meta.ui.resourceUri`.
- Sandboxed iframe rendering and CSP/permission metadata.
- JSON-RPC over `postMessage` through a host AppBridge.
- Text fallback for clients without UI support.

Primary references:

- [MCP Apps overview](https://modelcontextprotocol.io/extensions/apps/overview)
- [Stable MCP Apps specification (2026-01-26)](https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx)

TAP must preserve tool, resource, content, and result `_meta` end-to-end and advertise the extension during initialization. The bridge maps approved MCP messages such as tool calls, resource reads, messages, model-context updates, link opening, size changes, host-context changes, and teardown into TAP's authorization/event broker.

MCP `visibility: ["model", "app"]` is exposure metadata, not TAP human/specialist authorization. App-only tools stay out of the model/specialist tool catalog but still require TAP permission when the UI calls them.

The stable MCP Apps lifecycle defines initialization, context change, and `ui/resource-teardown`; general state persistence/restoration is deferred. Map teardown into TAP's pre-unmount path. Retained MCP views may negotiate an optional TAP lifecycle/checkpoint extension; otherwise they teardown and reinitialize.

## 11. Marketplace, install policy, and entitlements

### 11.1 Independent classification

Every listing/install shows separate badges or fields for:

- Source: bundled, Marketplace, npm, GitHub, zip, directory, or Zephyr.
- Publisher identity/signature status.
- Official approval status.
- Visibility: public, publisher-private, or workspace-private.
- Price/entitlement state.
- Runtime targets.
- Permission/effect risk.
- Update policy.

Official approval may allow a workspace administrator to create a pre-approved install policy; it never bypasses authorization, runtime sandboxing, or entitlement.

### 11.2 Installation scope

An installation records:

- Package/release/graph identity.
- User or workspace owner scope.
- Visibility and Marketplace listing provenance.
- Entitlement snapshot/reference.
- Approved permission action set and semantics hashes.
- Approved runtime effects and origins.
- Role recommendations accepted/overridden by workspace policy.
- Update policy/tag selector.
- Active and staged releases plus last-known-good.
- State/checkpoint retention policy.
- Audit history.

### 11.3 Update review

Treat these changes as privilege expansion:

- New permissions or effects.
- A wider resource/network/file scope.
- Human-only becoming specialist-eligible.
- Increased specialist autonomy or delegation depth.
- Reduced consent/freshness requirements.
- New CSP/resource/frame domains or device permissions.
- New credential use.
- Adding actions to an already granted package level.

Existing grants bind to permission semantics hashes or expanded immutable action sets so a publisher cannot silently widen a named level.

## 12. Developer watch, publish, and live reload

### 12.1 Required experience

A mini-app developer should be able to:

1. Create or open only the mini-app repository.
2. Run an SDK/build watch without rebuilding the full TAP desktop/mobile app.
3. Generate the static descriptor and target remote entries.
4. Publish each successful build as an immutable Zephyr snapshot.
5. Move/update a development tag.
6. Configure TAP to follow that package/tag.
7. See the package checkpoint, candidate realm load, health check, and live mount swap automatically.
8. Receive actionable validation, permission-diff, build, runtime, and fallback diagnostics.

### 12.2 Reuse Zephyr Panel mechanisms

Reuse the protocol ideas demonstrated by `zephyr-panel`:

- Application/version/tag selection.
- Session-specific remote override.
- WebSocket live-reload notifications.
- Snapshot polling/reconciliation when notifications are missed.
- Module-specific reload status and diagnostics.

Do not make the browser extension itself a runtime dependency. Extract or reproduce the generic wire contract in Zephyr packages/API and implement a TAP-native consumer.

### 12.3 Development activation

Follow-tag reload uses the same secure update path as OTA:

- Resolve the new immutable snapshot.
- Verify descriptor/graph/targets.
- Compute permission/effect diffs.
- Build a fresh candidate realm.
- Run pre-pause/checkpoint and candidate pre-resume/migration.
- Health-check and atomically route mounts.
- Roll back on failure.

Development mode may streamline prompts for unchanged previously approved permissions, but it must not permit namespace spoofing, undeclared effects, or direct host APIs.

## 13. Repository change plan

### 13.1 `ze-agency-tauri` — primary product and host

Role: canonical TAP package/product implementation in this workspace.

Changes:

- Rebase/extend PR #5881 onto current `main` without preserving its UI/tool-only limitation.
- Choose the validated, digest/SRI-locked descriptor-backed successor package system as canonical and add Marketplace signing over it. Its implemented schema is `TapPackageDescriptorV1`; “successor” describes the package-system migration, not a schema-v2 claim. Do not preserve `tap-apps`/`zephyr-package-manager`/`app-sdk` and PR #5881's `tap-apps2-*`/`packages/sdk` as parallel package formats. Merge author/build SDK and runtime SDK responsibilities behind intentional exports, migrate existing apps/Marketplace flows, and retire the legacy package paths.
- Define/generate the validated descriptor, contribution union, immutable
  package/release/install IDs, namespaces, graph lock, schemas, and
  compatibility rules; add cryptographic publisher/listing-release signing as
  a separate authenticity layer.
- Implement source adapters for bundled, npm, GitHub, zip, directory, Zephyr, and Marketplace packages.
- Implement staging/CAS, archive safety, signatures/hashes, atomic install/update/uninstall, last-known-good, and retention.
- Port—not merge unchanged—the useful official-approval, authz, and audit ideas
  from PR #3891 into the descriptor-backed Marketplace path. Its audited
  head `99800344e` is merge-dirty and targets the legacy `tap-apps` ZIP/minisign
  package contract. Build the successor around typed publisher, listing,
  immutable release, review attestation, install resolution, visibility,
  price/entitlement, workspace install policy, and audit records. Extend its
  publisher account/profile with immutable publisher identity and validated
  logo assets, optionally bound to a verified Zephyr organization; do not
  treat a TAP workspace avatar or package-supplied string as publisher proof.
- Implement the TAP lifecycle supervisor, realm/mount state, checkpoint service, pre-pause/pause/pre-resume/resume, fresh-realm update, and rollback.
- Implement isolated WebView/iframe and QuickJS runtime adapters plus SDK capability bridges.
- Expand SDK/config/registration APIs to the complete contribution union and reject descriptor/expose/runtime drift.
- Add the event broker, namespaces, schemas, filtering, delivery policy, and lifecycle events.
- Add permission catalogs, generated action constants, actor eligibility, role recommendations, grants, authorization context/epochs, and executor-side checks.
- Reconcile task contracts/statuses/authority and add task contributions.
- Add chat block durable envelopes, renderer protocols, isolated hosts, block SDK/actions/events, fallbacks, and lifecycle.
- Preserve MCP metadata, negotiate MCP Apps, implement AppBridge/sandbox/CSP/permission enforcement, and add fallback behavior.
- Migrate existing core mini apps and remove hardcoded tool/specialist/app exceptions.
- Replace PR #5881's direct generic rail buttons with the workspace Apps selector, separator, bounded/reorderable workspace pins, immutable contribution routes, unavailable states, and a workspace-level mount host that is not coupled to chat panel state.
- Turn the desktop channel `PanelRightIcon` toggle into the host-owned `Blocks` Apps button; split the existing conversation launcher into Pinned/Core/Installed/Unavailable groups and resolve eligible apps per room rather than offering every `showInWorkspace` app everywhere.
- Add a canonical protobuf-backed synchronized per-user workspace/channel pin service through Chat API v1, capability-checked queries/mutations, cache invalidation/realtime updates, and deterministic ordering. The repository's documented ownership boundary keeps non-chat apps/settings on v1; Chat API v2 remains chat-only. Keep pin membership out of `panel-store`/Zustand; retain that store only for local/open-tab layout state. Replace `showInWorkspace` with explicit resolved placements.
- Land and preserve plural validated, digest/SRI-locked package/collection/contribution presentation candidates, then bind them to the future Marketplace release signature. Project `packageIconAssets` and ordered/inherited `surfaceIconAssets`, select by light/dark theme plus CSS size and DPR, keep deterministic host fallbacks and safe image rendering, and finish publisher identity/logo resolution plus migration from duplicated arbitrary Lucide maps.
- Keep package registry state truthful in the rail, channel launcher, and Settings: distinguish loading, legitimate empty, ready, stale cached data, and unavailable initial data; retain usable stale data and provide a bounded retry rather than rendering a false zero-app success state.
- Add desktop/mobile target selection and UI surfaces, mobile Apps-selector convergence, automation hooks, `data-testid` anchors, generated bindings, and product tests.

Likely ownership areas include existing or PR-introduced `tap-apps*` crates, package manager crates, app SDK/SDK packages, permissions/authz/platform packages, MCP and rich-chat code, Tauri commands, mobile/desktop hosts, workers, schemas, and generated bindings. Navigation starting points include `apps/desktop/src/components/layout/new-sidebar/new-sidebar.tsx`, `workspace-rail-model.ts`, `workspace-chrome.tsx`, `chat-panel-controls-toolbar.tsx`, `conversation-side-panel-tabs*.ts*`, `chat-layout.tsx`, `packages/stores/src/panel-store.ts`, PR #5881's mini-app surface query/routes, and the corresponding mobile toolbar. Adding an Apps rail destination also updates rail deep links, website open-section mappings, shell skeletons, command-center commands, and generated route trees. Exact paths must follow local `AGENTS.md` rules when implementation begins.

Dependencies:

- Consume released Module Federation core support.
- Consume released Zephyr `tap-app` build/control-plane support.
- Consume released workflow sidecar/contracts before updating the product pin.

Verification:

- Rust/TypeScript schema round trips.
- Source resolver and archive/security tests.
- WebView/QuickJS lifecycle and isolation tests.
- Permission/event/task/chat/MCP adversarial tests.
- Product unit/integration checks required by touched local instructions.

### 13.2 `core` (`module-federation/core`) — runtime primitives

Role: upstream/general Federation mechanics only; TAP trust and Marketplace policy do not belong here.

Changes:

- Add a first-class application lifecycle hook group or generic extension-hook registry available before runtime plugin registration.
- Add typed `prePause`, `pause`, `preResume`, `resume`, and lifecycle error contexts/results; consider the matching activate/mount/unmount/deactivate family.
- Define serial ordering, deadlines, cancellation, structured decisions, forced-transition behavior, observer failure isolation, and transition IDs.
- Export the necessary public hook/context types rather than importing runtime internals.
- Validate ESM remote entries and non-browser/custom entry loaders.
- Keep React/Vue Bridge hooks as rendering instrumentation; add tests proving they are not treated as exactly-once lifecycle state.

Likely paths:

- `packages/runtime-core/src/core.ts`
- `packages/runtime-core/src/type/plugin.ts`
- `packages/runtime-core/src/utils/plugin.ts`
- `packages/runtime-core/src/utils/hooks/**`
- Runtime core and bridge tests

Release the affected Federation packages before pinning/consuming them in TAP.

### 13.3 `zephyr-packages` — build and publish integration

Role: public build plugins, edge contract, client publishing, and generated Zephyr artifacts.

Changes:

- Add `tap-app` to canonical build/application target unions currently covering web/mobile targets.
- Extend the Zephyr edge contract, agent, CLI, and shared xpack internals with TAP package metadata.
- Extend Rsbuild/Rspack first, then other supported bundler plugins, to
  transport `tap-app` target-specific ESM entries, Federation manifests, and
  the descriptor/lock artifacts already assembled by the TAP SDK without
  rewriting their paths, bytes, or integrity metadata.
- Preserve and upload TAP SDK-validated PNG/passive-SVG assets and their
  theme/size/role metadata byte-for-byte. Semantic descriptor/asset-lock
  generation, image validation, and active-content rejection belong to
  `ze-agency-tauri/packages/sdk`, not the generic Zephyr plugin.
- Transport multi-entry collections and independently versioned child remotes;
  parent graph semantics remain the TAP package contract.
- Publish immutable snapshots and update tag selectors for pinned, next-launch, OTA, and development follow-tag policies.
- Add a watch command and diagnostics suitable for SDK-only mini-app development.
- Add conformance fixtures for desktop/mobile/background exposes and descriptor drift.

Likely packages include `zephyr-edge-contract`, `zephyr-agent`, `zephyr-cli`, `zephyr-rsbuild-plugin`, `zephyr-rspack-plugin`, `zephyr-webpack-plugin`, and shared internals.

Known target-type touchpoints include `libs/zephyr-agent/src/zephyr-engine/index.ts`, `libs/zephyr-edge-contract/src/lib/ze-api/converted-graph.ts`, `libs/zephyr-edge-contract/src/lib/plugin-options/zephyr-webpack-plugin-options.ts`, and the federation dashboard plugin options under `libs/zephyr-xpack-internal`.

### 13.4 `zephyr-cloud-io` — Zephyr control plane

Role: application/build target persistence, snapshots/tags, publish APIs, auth/RBAC, and live-reload notification schema.

Changes:

- Persist and expose the `tap-app` target/application type in the database, API schemas, services, and dashboard where relevant.
- Store/serve immutable TAP descriptors, graph metadata, remote entry/assets, target variants, and readiness state.
- Resolve exact snapshots and tags without confusing a mutable tag with an immutable release.
- Extend publisher authentication/RBAC and namespace proof needed by TAP package publication.
- Make the publisher organization profile's logo upload/persistence/versioning work end to end and expose the immutable publisher-to-logo binding needed by Marketplace. Replace arbitrary hot-linked logo URLs with validated, content-addressed assets while preserving a public read model.
- Extend application-tag and WebSocket notification schemas for TAP follow-tag reload.
- Harden the current application-UID-scoped live-reload bearer for private/workspace packages. Issuance and room join must authorize the exact organization/project/application plus environment and followed tag, and add bounded replay/session controls. The ticket deliberately must not pin one immutable snapshot because a followed tag moves; each notification instead identifies the newly resolved immutable snapshot. TAP separately rechecks the package installation, Marketplace entitlement, and activation policy before accepting that snapshot. Client-side filtering is not a privacy boundary.
- Regenerate `ze-sdk`; do not hand-edit generated output.
- Add API, migration, tag, access-control, snapshot, and live-reload tests.

One known API touchpoint is `apps/api/src/routes/builder-packages-api/dtos/gateway-publish.dto.ts`; generated `packages/ze-sdk` output follows the source schemas.

Boundary: TAP Marketplace pricing, official approval, publisher account, installation grants, and workspace entitlements remain product policy in `ze-agency-tauri`; Zephyr owns deployment/version data and its own organization profile. A verified binding may import/mirror a Zephyr organization logo into the Marketplace publisher profile, but the deployment organization alone does not confer Marketplace verification.

### 13.5 `zephyr-mono` — conditional edge delivery work

Role: legacy/current edge workers and static upload/runtime delivery where still canonical.

Change only if required after ownership confirmation:

- Recognize `tap-app` during worker validation, routing, or upload.
- Serve immutable Federation manifests, ESM remote entries, and assets with correct content types, caching, integrity, and CORS/isolation behavior.
- Surface snapshot readiness required by tag-follow reconciliation.

Do not duplicate control-plane policy or TAP authorization here.

### 13.6 `zephyr-panel` — live-reload reference and optional protocol work

Role: reference implementation for session overrides, version/tag selection, WebSocket reload, polling, and module status.

Preferred outcome:

- Reuse/extract its protocol concepts into Zephyr packages/API.
- Implement the actual TAP client in `ze-agency-tauri`.
- Change `zephyr-panel` only if the shared wire protocol evolves or a reusable non-browser reload client is deliberately exported.

The browser extension must not become a TAP runtime dependency.

### 13.7 `ze-workflows` — workflow and node authority

Role: canonical workflow engine, node registry, runner semantics, host ports, QuickJS host, sidecar protocol, and sidecar packaging.

Changes:

- Define package-contributed `workflow` and `workflow.node` schemas and compatibility.
- Add namespaced node registration/admission that rejects undeclared or conflicting nodes.
- Bind nodes to permissions, effects, input/output ports, retries, idempotency, and lifecycle.
- Define how Federation/ESM modules are loaded into the workflow QuickJS/host runtime without bypassing the sidecar protocol.
- Add conformance for target selection, package version pinning, migrations, and unavailable-package fallback.
- Publish a sidecar release first; only then update the pin and TAP host adapter in `ze-agency-tauri`.

Likely packages include the node registry, workflow protocol/loader, rquickjs host, and workflow sidecar.

### 13.8 `tap-miniapps` — examples and conformance packages

Role: public/official examples; never the source of host contracts.

Changes:

- Convert Games and Playground to the validated, digest/SRI-locked descriptor
  and Federation remote-entry model.
- Preserve the parent collection and multiple Games surfaces.
- Add examples for parent/child remotes, standalone contributions, target-specific desktop/mobile modules, and QuickJS background work.
- Add distinct parent/package/contribution icon assets, light/dark variants, system-icon fallback, a workspace-launchable surface, a channel-only surface, and fixtures proving the two pin locations remain independent.
- Add lifecycle checkpoint/pause/resume, typed events, permission levels/actors, task type/attribute, workflow/node, chat block, and MCP App examples.
- Add a follow-tag live-reload example and validation scripts.
- Ensure examples fail when declaration/expose/runtime registration drift occurs.

### 13.9 `tap-e2e` — cross-target acceptance

Role: target-agnostic Playwright/E2E coverage only. Product contracts and test IDs land in `ze-agency-tauri` first.

Coverage:

- All seven source paths and correct official/untrusted presentation.
- Public, publisher-private, workspace-private, free, paid, allowed, and denied installs.
- Parent collections, child remotes, standalone contributions, dependency locks, and namespace collision/spoof attempts.
- Desktop/mobile target selection and QuickJS/background execution.
- Pinned, next-launch, OTA, follow-tag, failed candidate, rollback, and last-known-good.
- Lifecycle ordering, transition races, forced pause, checkpoint failure, resume failure, and independent mount scopes.
- Event namespace/schema/scope filtering and paused-delivery behavior.
- Human-only, human/specialist, delegation, role recommendation, consent, revocation, permission expansion, and entitlement gates.
- Task types/attributes/fallback/status mapping/effective visibility.
- Chat block renderer modes, virtualization lifecycle, actions, fallback, missing package, and unsupported target.
- MCP Apps negotiation, metadata, sandbox/CSP, app-only tools, teardown, authorization, and fallback.
- Workspace rail separator/Apps selector/pin order/overflow, direct pinned launch, unavailable state, unpin/reorder, and keyboard/accessibility behavior.
- Channel Apps button semantics and active state, per-room eligibility, per-channel pins, and proof that channel-only apps never leak onto the workspace rail or another channel.
- Package/surface/publisher/organization/workspace icon ownership, plural PNG/SVG theme/size/DPR selection, inheritance, digest/SRI-lock plus future signature behavior, malicious SVG/image rejection, and publisher-logo spoof prevention.
- Registry loading versus legitimate-empty versus stale/unavailable behavior and retry affordances in workspace rail, channel launcher, and Settings.
- Live reload without rebuilding TAP.

Follow the repo's dual-target spec/page-object rules and read CEF logs before changing timeouts.

### 13.10 `tap` — reference or successor alignment only

The local `tap` repository contains foundation contracts and useful security-first implementations, but the workspace authority assigns current product behavior to `ze-agency-tauri`.

Default plan: use it as research/reference and do not independently implement a competing package contract. If leadership designates it as the successor canonical product repository, port the generated contract and capability documents there in a separately planned migration rather than maintaining divergent schemas.

### 13.11 `zephyr-examples` — optional generic Zephyr fixture

No required TAP product change. `tap-miniapps` owns TAP-specific examples. Add a small generic Zephyr `tap-app` build fixture only if Zephyr plugin/control-plane CI requires an example that should not depend on TAP product code.

## 14. Delivery order

The programme-level sequence below remains the dependency map for a clean-room
delivery. Several foundation items are now locally implemented; it must not be
read as a current completion checklist. Section 14.1 is the audited priority
queue for the work that remains.

1. **Contract/RFC:** freeze identity, descriptor, contribution, target/runtime, namespace, lifecycle, event, permission, task, chat-block, presentation-asset, placement/pin, and Marketplace schemas.
2. **Task/role normalization:** establish generated canonical task/status/authority and role/action types before extensions bind to them.
3. **Module Federation core:** add/release lifecycle extension and validate ESM/custom loaders.
4. **Zephyr packages:** add/release `tap-app` target propagation, immutable
   artifact/manifest transport, multi-entry publication, and watch support;
   TAP descriptor/lock generation stays in the product SDK.
5. **Zephyr control plane:** migrate/store/serve target metadata, snapshots, tags, namespaces, and live-reload notifications; update edge workers only if needed.
6. **Workflow authority:** add/release contributed workflow/node contracts and sidecar.
7. **TAP package host:** implement source resolution, verification, installation, realms, lifecycle, SDK, events, authorization, updates, app discovery, pin persistence, and safe brand rendering in `ze-agency-tauri`.
8. **Tasks and workflows integration:** consume the canonical task contract and released workflow sidecar.
9. **Chat blocks and MCP Apps:** add durable block envelopes, isolated renderer hosts, block SDK, MCP metadata/negotiation/AppBridge.
10. **Marketplace:** finish official approval, visibility, paid entitlement, workspace install policy, verified publisher profiles/logos, package presentation assets, and update review.
11. **Developer loop:** connect watch publishing, tag follow, WebSocket/poll reconciliation, fresh-realm swap, and diagnostics.
12. **Migration/examples:** migrate core mini apps and `tap-miniapps`; remove legacy registration exceptions.
13. **E2E and release gates:** execute the complete cross-source/cross-target/security/update matrix before general availability.

### 14.1 Audited remaining implementation dependencies

There are three parallel lanes, but the order inside each lane is a hard
dependency. Cross-lane release gates are called out explicitly so a schema or
mock cannot be mistaken for a working surface.

**Runtime and contribution lane (execute in this order):**

1. **Complete the production fresh-realm OTA transaction.** Exact candidate
   verification, target/container readiness, activation-pending tool/event
   quarantine, bounded exact-release checkpoints, actor rollback, and
   next-launch staging are implemented foundations. Remaining work is to
   release/pin the Federation lifecycle extension and integrate distinct
   concurrently retained old/candidate UI and isolate realms, explicit
   cross-release checkpoint migration, a Rust-owned CAS promotion/crash
   journal, all-active-target health coordination, atomic route/authority
   switch, and bounded old-realm retention. Until that integration is green,
   `ota` continues to mean verified staging plus next-launch activation.
2. **Federated `skill` consumer.** Bridge validated, release-locked skill contributions into the
   canonical skill registry with installation/release ownership, scope,
   permissions, event subscriptions, activation rollback, and deterministic
   unregister. This is the first non-tool reference consumer for the common
   contribution adapter.
3. **Federated `specialist` consumer.** Reuse that adapter for specialist
   definitions and collections, then apply actor eligibility, attenuated human
   authority, tool/skill resolution, lifecycle, and cleanup in the canonical
   specialist store.
4. **Canonical `workflow` and `workflow.node` consumer.** Change and release
   `ze-workflows` first; only then update the TAP sidecar pin and host adapter.
   The package manager must not create a competing in-product node authority.
5. **MCP and rich rendering.** Add `mcp.server`, tool/prompt/resource/template,
   MCP App/UI, `ui.renderer`, and `chat.block` consumers behind the shared
   isolated AppBridge/rendering boundary, durable fallback envelope, CSP, and
   package lifecycle cleanup.
6. **Task contributions.** After canonical task/status/authority types are
   generated, integrate task type, attribute, view, action, and template
   registries with namespaced migrations and durable unavailable fallbacks.
7. **Knowledge contributions.** Add plot template, source provider, enricher,
   and retriever adapters to the Knowledge Garden authorities with explicit
   workspace/data scope and update/uninstall cleanup.
8. **Browser extensions last.** Integrate only after the common contribution
   lifecycle/permission/rollback boundary is proven, because native browser
   profile access and extension permissions require the widest platform review.

Every step above must ship one standalone package fixture and one cohesive
multi-contribution fixture, plus install/activate/update/rollback/uninstall
tests. Advancing to the next consumer requires proving that the prior consumer
leaves no registrations, grants, subscriptions, mounts, or durable references
after rollback/uninstall.

**Marketplace lane (may run beside the runtime lane, in this order):**

1. Define server-owned publisher/profile, listing, immutable listing release,
   review attestation, visibility, offer, entitlement, and install-resolution
   records using the canonical package/release identities already validated by
   `zephyr-package-manager`.
2. Port PR #3891's useful approval roles, authorization checks, and audit trail
   to those records; do not merge its legacy ZIP/minisign acquisition path.
3. Implement authenticated publication/moderation/profile-logo APIs and paid
   entitlement authority, including public, publisher-private, and exact
   workspace-private policies.
4. Implement one canonical Marketplace resolution/install RPC that returns the
   immutable descriptor/graph identity, review evidence, entitlement evidence,
   and scoped install grant. Feed it through the same verified artifact
   registration transaction as manual sources; no frontend-supplied Official or
   paid fields are accepted.
5. Add catalog/install/update/revoke/quarantine UX, verified publisher branding,
   and live control-plane E2E. Only this lane may produce the Official badge.

**Mobile lane (backend/build prerequisites are implemented; execute the
remaining work in this order):**

1. **Finish the mobile frontend realm.** Transactional multi-target assembly,
   trusted Desktop/Mobile projection, portable loopback asset serving, shared
   package commands, and native suspend/resume runtime transitions are landed.
   Add the actual mobile WebView Federation frame host, SDK/action/event
   transport, Apps sheet/tab selector, workspace/channel pin presentation,
   routes, Settings/permission review, empty/stale/error states, and
   target-incompatible fallback.
2. **Complete mobile conformance packages.** Design Viewer and Kent already
   publish distinct mobile entries. Add a target-specific `tap-miniapps`
   fixture and prove that no desktop expose, tool, or capability is selected on
   a mobile host.
3. **Run native acceptance.** Add Appium installation/launch/pin/pause/resume/
   checkpoint/update/uninstall tests on iOS and Android. Desktop Playwright
   discovery and backend cross-compilation are not evidence for the mobile UI.

Cross-lane gates: Marketplace E2E depends on its authoritative install RPC;
mobile OTA depends on both the mobile realm (mobile steps 1-3) and the fresh-
realm OTA transaction; paid or private contributions must pass entitlement and
visibility again at activation/invocation, not only at catalog install.

## 15. Validation strategy

### 15.1 Contract validation

- One source-of-truth schema with generated Rust and TypeScript types.
- Unknown policy fields denied; compatibility metadata versioned.
- Descriptor, remote exposes, and runtime registration agree exactly.
- Parent/child graphs are acyclic, immutable, and target-compatible.
- Event, permission, task attribute, tool, node, and block payload schemas have size/depth limits.

### 15.2 Security validation

- Namespace impersonation from npm/GitHub/zip/directory packages.
- Zip-slip, symlink, decompression-bomb, oversized file/count, and hash mismatch.
- Remote entry or asset substitution after review.
- Undeclared remote/expose/tool/event/permission/action/node/renderer.
- Cross-workspace, cross-channel, cross-conversation, and private-task leakage.
- Specialist escalation beyond represented human or delegation parent.
- Role recommendation treated as grant.
- Paid/official status treated as authorization.
- CSP/origin/network bypass, service-worker/storage sharing, unsafe links, and host DOM escape.
- MCP app cross-server/app-only tool misuse and unapproved metadata widening.
- Stale authorization epoch or capability handle use after pause/revocation/update.

### 15.3 Lifecycle/update validation

- Duplicate/concurrent pause/resume requests serialize idempotently.
- Pre-pause deadline, failure, and forced-pause behavior.
- Pre-resume context/checkpoint validation and migration failure.
- Mount-scoped pause does not pause unrelated mounts/background work.
- Candidate health failure leaves the old release active.
- Atomic routing swap and rollback preserve events/actions/state.
- Old release/cache retention and eventual cleanup are bounded.

### 15.4 Compatibility and fallback validation

- Desktop/mobile expose selection and unsupported-target fallback.
- QuickJS ESM loading, SDK share resolution, CPU/memory/timeout enforcement.
- Missing/uninstalled/quarantined package task fields and chat blocks remain readable.
- MCP Apps text fallback when UI negotiation is unavailable.
- Old task/block schema migration or opaque fallback.
- Offline and reconnect behavior for pinned/tagged installations.

### 15.5 Developer experience validation

- Package-only watch and publish.
- No full TAP rebuild for a mini-app code change.
- WebSocket reload plus polling reconciliation.
- Permission/effect expansion stops reload with a clear review action.
- Build/descriptor/runtime errors identify package, release, target, contribution, and expose without logging secrets.

### 15.6 Navigation, pinning, and branding validation

- Tasks remains the last built-in rail destination, followed by the separator, Apps selector, and only eligible workspace/global pins.
- The Apps selector remains reachable with no apps, load errors, short windows, large UI scale, keyboard-only navigation, and enough pins to overflow.
- Workspace pin create/remove/reorder synchronizes per user without entering Zustand server-state mirrors; concurrent rank edits converge deterministically.
- A channel-only contribution cannot be pinned to the workspace rail, and a channel pin cannot appear in another channel or bypass room access.
- Pinning grants no permission/entitlement, starts no background runtime by itself, and unpinning does not uninstall or stop unrelated contributions.
- Temporarily offline, incompatible, unlicensed, revoked, quarantined, updated, removed, and reinstalled contributions preserve or remove pin state according to the explicit rules in Section 5.7.
- The channel header uses the Apps label/glyph/active state and continues to open the current conversation selector across docked, drawer, expanded, and mobile layouts.
- Contribution, package, parent collection, publisher, and workspace icons follow the documented ownership and fallback chain.
- `packageIconAssets` retains the explicit ordered parent-package selection from `presentation.iconAssets` (or every package `app-icon` only for backwards compatibility); `surfaceIconAssets` retains an explicit child selection or inherits that parent set when omitted/empty. A child contribution cannot replace collection artwork.
- PNG and SVG icons both render for package, collection, contribution, pinned-rail, channel-selector, and Marketplace placements with the same fallback rules. Light/dark selection, CSS rendered size, DPR, fixed raster dimensions, scalable `any`, and declaration-order tie-breaking are deterministic.
- Missing light/dark/size variants, digest or media mismatches, excessive dimensions/bytes/pixel counts, malformed/polyglot PNGs, animated payloads, SVG scripts/event handlers/`foreignObject`/external references, and arbitrary logo URLs fail safely.
- When typed asset purposes land, monochrome and maskable candidates have separate host-consumer and fallback tests; a filename or visually monochrome SVG never activates those modes implicitly.
- A manually sourced package cannot display another Marketplace publisher's organization logo or verification badge.
- App icon changes follow active immutable releases; publisher-logo changes are versioned/audited independently and do not mutate package identity.
- App registries never map transport/query failure to “No apps.” Initial failure renders unavailable plus retry; refresh failure with prior data renders stale plus retry; only a successful loaded empty set renders the empty state.
- Persisted pin-order tests require an explicit synchronized rank/reorder contract; storage-vector, registration, timestamp, or query arrival order is not accepted as user order.

## 16. Open decisions with recommended defaults

| Decision                            | Recommended default                                                                                                                                                                                    |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Public namespace shape              | `tap-pkg.<globally-reserved-package-namespace>.*`, backed by immutable package ID                                                                                                                      |
| Unsigned package namespace          | `tap-pkg.untrusted.<digest>.*`                                                                                                                                                                         |
| Static descriptor format            | Validated JSON plus generated types/schema and digest/SRI lock now; publisher/listing signature required for Marketplace authenticity; executable config is not authoritative                          |
| Federation lifecycle implementation | First-class typed hook group in core; one trusted TAP controller initially                                                                                                                             |
| Package lifecycle API               | Fixed `./tap/lifecycle` expose                                                                                                                                                                         |
| Update mechanism                    | Fresh realm, atomic pointer swap, last-known-good rollback                                                                                                                                             |
| Default update policy               | Pinned for untrusted/manual sources; explicit publisher/workspace policy elsewhere                                                                                                                     |
| Default event delivery              | Ephemeral, at-most-once, ordered per realm/installation                                                                                                                                                |
| Package React execution             | Isolated realm for all third parties; host realm only for TAP core                                                                                                                                     |
| Raw HTML                            | Isolated iframe, scripts/network disabled unless declared and approved                                                                                                                                 |
| MCP UI                              | Stable MCP Apps 2026-01-26 protocol plus optional negotiated TAP lifecycle extension                                                                                                                   |
| Specialist authority                | Borrowed/attenuated by default; autonomous work requires an expiring explicit lease                                                                                                                    |
| Package levels                      | Explicit includes DAG; never globally comparable numeric levels                                                                                                                                        |
| Task statuses                       | Preserve canonical TAP status plus namespaced type state mapping                                                                                                                                       |
| Task attributes                     | Namespaced/reference-scoped; installation alone never mutates all tasks                                                                                                                                |
| Old chat block rendering            | Persist contentful fallback; retain executable releases only under bounded policy                                                                                                                      |
| Zephyr Panel                        | Protocol reference, not runtime dependency                                                                                                                                                             |
| Host Apps glyph                     | Lucide `Blocks`; keep `Puzzle` for extensions/integrations and `PanelRightIcon` for generic layout controls                                                                                            |
| Workspace rail composition          | Tasks, separator, Apps selector, bounded ordered workspace/global pins, then fixed host utilities                                                                                                      |
| Pin ownership                       | Synchronized per-user host preference; admin defaults/recommendations are separate policy records                                                                                                      |
| Channel app pinning                 | Per user/workspace/channel contribution; never promoted to the workspace rail without a workspace placement                                                                                            |
| Package visual identity             | Plural validated, digest/SRI-locked PNG/SVG presentation candidates, with package and surface sets kept separate, a generated safe `systemIcon` fallback union, and future Marketplace release signing |
| Icon variant selection              | Exact effective theme first, then `any`; CSS size × DPR with exact/scalable/nearest-size ranking and declaration order as final tie-breaker                                                            |
| Publisher logo                      | Verified organization-profile asset resolved by immutable publisher ID, not package-supplied display metadata                                                                                          |

Decisions still requiring product/security sign-off:

- Namespace reservation and publisher-transfer rules for organization suites and subpackages.
- Exact Marketplace billing owner/data model and private-workspace sharing workflow.
- Default update policy for official Marketplace packages.
- Checkpoint quotas, encryption, retention, and migration rollback window.
- Which runtime effects require fresh human consent regardless of reusable grants.
- Whether any reviewed third party may ever use a host-realm renderer.
- The optional MCP Apps lifecycle extension identifier and compatibility strategy.
- How long CAS retains old releases referenced by durable messages or tasks.
- Maximum directly visible workspace pins versus overflow-only pins at each supported rail height/UI scale.
- Whether workspace administrators may enforce pins or only recommend defaults; enforced navigation should require explicit product-policy review.
- Publisher-logo moderation and historical snapshot policy when a verified organization rebrands.

## 17. Conversation coverage audit

| Requirement from the discussion                                                                   | Covered in                                    | Primary owner / acceptance evidence                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Research PR #5881 and extend what exists                                                          | Sections 4.1 and 13.1                         | `ze-agency-tauri`; the descriptor-backed successor (implemented as `TapPackageDescriptorV1`) replaces the UI/tool-only surface and migration tests pass                                                                       |
| Official Marketplace approval through PR #3891                                                    | Sections 3.1, 3.2, 11, 13.1, 14.1, and 19.6   | `ze-agency-tauri`; preserve #3891 approval/authz/audit intent but port it from legacy ZIP/minisign to typed descriptor-backed records—the audited PR cannot merge unchanged                                                   |
| Marketplace workspace installation                                                                | Sections 3.1, 11, and 13.1                    | `ze-agency-tauri` + `tap-e2e`; scoped install succeeds/denies by workspace policy                                                                                                                                             |
| Bundled repo, npm, GitHub, zip, directory, and Zephyr sources                                     | Sections 3.1, 5.6, 13.1, and 13.9             | `ze-agency-tauri`; resolver/security tests plus `tap-e2e` source matrix                                                                                                                                                       |
| Untrusted presentation for manual sources                                                         | Sections 3.1, 5.1, 5.6, 11, and 15.2          | `ze-agency-tauri`; every manual install retains Untrusted status and cannot spoof namespace                                                                                                                                   |
| Public, publisher-private, workspace-private                                                      | Sections 3.2 and 11                           | `ze-agency-tauri`; listing/install visibility and cross-workspace denial tests                                                                                                                                                |
| Paid packages and entitlements                                                                    | Sections 3.2, 8.4, and 11                     | `ze-agency-tauri`; entitlement checked independently at install and invocation                                                                                                                                                |
| Module Federation remote entry as common load mechanism                                           | Sections 2, 4.4, and 5.5                      | `core` + `ze-agency-tauri`; one locked graph loads UI/background exposes                                                                                                                                                      |
| Deep inspection of local Module Federation core                                                   | Sections 4.4, 6.2, 6.3, and 13.2              | `core`; hook/order/cache/reentrancy tests encode findings                                                                                                                                                                     |
| ESM targets and Rsbuild/Rspack                                                                    | Sections 4.4, 5.5, and 13.3                   | `zephyr-packages` + `core`; emitted ESM entries import with correct chunks/MIME/CORS                                                                                                                                          |
| QuickJS isolate/background Federation support                                                     | Sections 3.4, 5.5, 6, 13.1, and 13.7          | `ze-agency-tauri` + `ze-workflows`; no-DOM conformance, quotas, SDK bridge, sidecar tests                                                                                                                                     |
| One package mechanism across UI and non-UI modules                                                | Sections 2 and 5                              | `ze-agency-tauri`; one descriptor/lock selects multiple target runtimes                                                                                                                                                       |
| Parent entry containing multiple remotes/apps                                                     | Sections 3.3, 5.2, 11, and 13.8               | `tap-miniapps` fixture + host tests for required/optional/private/unlicensed children                                                                                                                                         |
| Zephyr versioning and instant deployment                                                          | Sections 3.3, 6.6, 12, 13.3, and 13.4         | `zephyr-packages` + `zephyr-cloud-io`; immutable snapshot/tag notification tests                                                                                                                                              |
| Pinned, OTA, next-launch, and follow-tag modes                                                    | Sections 3.3, 6.6, 11.3, and 12               | `ze-agency-tauri` + `tap-e2e`; activation timing and rollback matrix                                                                                                                                                          |
| Add Zephyr `tap-app` type beside mobile/web                                                       | Sections 3.4, 13.3, 13.4, and 13.5            | `zephyr-packages` + `zephyr-cloud-io`; schema/build/API/DB matrix accepts `tap-app`                                                                                                                                           |
| Different desktop and mobile modules                                                              | Sections 3.4, 5.5, 14.1, 15.4, and 19.6       | Target-generic backend projection, portable asset serving, and distinct Design Viewer/Kent desktop/mobile remotes are implemented; the mobile frontend host and native-device E2E remain                                      |
| Mini-app-only watch without rebuilding TAP                                                        | Section 12                                    | `zephyr-packages` + `tap-miniapps`; package edit publishes a new immutable snapshot and advances a followed tag without rebuilding TAP. Product activation remains safely staged until the fresh-realm handoff exists         |
| Reuse Zephyr Panel live reload/refresh mechanics                                                  | Sections 12.2 and 13.6                        | Zephyr API/packages + TAP client; authenticated socket and missed-notification polling tests                                                                                                                                  |
| Review current core apps and `tap-miniapps`                                                       | Sections 4.2, 4.3, 13.1, and 13.8             | `ze-agency-tauri` + `tap-miniapps`; all current apps migrate without declaration drift                                                                                                                                        |
| Skills, tools, MCPs, specialists, workflows, workflow nodes, mini apps, browser extensions, plots | Sections 5.3, 14.1, and 19.6                  | Broad descriptor schema exists; ordered production consumers and standalone/bundled fixtures remain required in owning product/workflow repos                                                                                 |
| Additional missing module families                                                                | Sections 4.2, 5.3, 9, and 10                  | `ze-agency-tauri`; renderers/prompts/actions/connectors/triggers/tasks/chat/knowledge/provider fixtures                                                                                                                       |
| Cohesive bundles and standalone modules                                                           | Sections 3.3 and 5.3                          | `tap-miniapps`; contribution selector and parent collection conformance                                                                                                                                                       |
| Namespaced host and package events                                                                | Sections 5.1 and 7                            | `ze-agency-tauri`; namespace, schema, dependency, rate, scope, and spoof tests                                                                                                                                                |
| `tap-pkg.planetscale.*` public example                                                            | Sections 5.1 and 7                            | `ze-agency-tauri`; SDK auto-prefix plus immutable namespace/envelope test                                                                                                                                                     |
| Install/mount/channel/pause/uninstall lifecycle events                                            | Sections 6 and 7.3                            | `ze-agency-tauri`; ordered authoritative state/event integration tests                                                                                                                                                        |
| Extend Federation with pause/resume hooks                                                         | Sections 6.3 through 6.5 and 13.2             | `core`; typed hook registration proves unknown hook problem is resolved                                                                                                                                                       |
| Pre-pause persistence and pre-resume context loading                                              | Sections 6.4 and 6.5                          | `ze-agency-tauri`; deadline/checkpoint/migration/context/forced-transition tests                                                                                                                                              |
| Per-mount versus whole-package lifecycle                                                          | Sections 6.1, 6.5, and 10.3                   | `ze-agency-tauri`; one hidden block pauses without stopping other mounts/background                                                                                                                                           |
| Task types, task attributes, and module options                                                   | Sections 5.4 and 9                            | `ze-agency-tauri`; generated contract, status mapping, CRDT/migration/fallback tests                                                                                                                                          |
| Permissions and levels inherited through TAP roles                                                | Section 8                                     | `ze-agency-tauri`; canonical policy maps reviewed package profiles without self-grant                                                                                                                                         |
| Human-only versus human/specialist permissions                                                    | Sections 8.1 through 8.3                      | `ze-agency-tauri`; executor-kind and fresh-attestation matrix                                                                                                                                                                 |
| Specialist borrowed/delegated authority cannot escalate                                           | Sections 8.2 and 8.3                          | `ze-agency-tauri`; human/specialist/child intersection and revocation tests                                                                                                                                                   |
| Raw HTML/CSS chat blocks                                                                          | Sections 10.1 and 15.2                        | `ze-agency-tauri`; CSP/origin/host-DOM/network/size isolation tests                                                                                                                                                           |
| Chat blocks using TAP SDK components/events                                                       | Sections 10.1 through 10.3                    | `ze-agency-tauri` + `tap-miniapps`; isolated federated renderer and broker tests                                                                                                                                              |
| MCP UI/MCP Apps                                                                                   | Sections 10.4, 13.1, and 15.4                 | `ze-agency-tauri`; negotiation, `_meta`, sandbox, app-only tool, teardown, fallback tests                                                                                                                                     |
| Durable fallbacks for missing/incompatible blocks                                                 | Sections 10.2 and 15.4                        | `ze-agency-tauri`; uninstall/quarantine/entitlement/mobile/offline transcript tests                                                                                                                                           |
| Apps selector below Tasks with a separator                                                        | Sections 4.6, 5.7, 13.1, and 15.6             | `ze-agency-tauri`; live `WorkspaceNavRail` renders Tasks, separator, Apps, then bounded pins                                                                                                                                  |
| Direct left-rail launch for pinned non-channel-only apps                                          | Sections 5.7 and 15.6                         | `ze-agency-tauri` + `tap-e2e`; only eligible workspace/global contributions pin and route by immutable identity                                                                                                               |
| Channel-specific apps pinned inside the Mini Apps selector                                        | Sections 5.7, 13.1, and 15.6                  | `ze-agency-tauri`; per-user/per-room query tests prove channel isolation and no workspace-rail leakage                                                                                                                        |
| Turn the channel panel toggle into an Apps icon                                                   | Sections 4.6, 5.7, and 16                     | `ze-agency-tauri`; `PanelRightIcon` becomes the accessible host `Blocks` Apps control with active state                                                                                                                       |
| Choose between supplied blocks and puzzle symbols                                                 | Sections 5.7 and 16                           | Product default is `Blocks`; `Puzzle` remains extensions/integrations semantics                                                                                                                                               |
| Define mini-app, collection, contribution, organization/publisher, and workspace logos            | Sections 4.6, 5.8, 13.1, 13.3, 13.4, and 19.6 | Validated, digest/SRI-locked role schema plus future release signing, verified publisher-profile binding, and explicit ownership/fallback/spoof tests; package-supplied publisher/organization roles never imply verification |
| Explain where icons are defined today and close current loss/drift                                | Sections 4.6 and 18                           | PR/legacy/TAP/Zephyr evidence; the descriptor path preserves per-contribution icons. Remaining core-app maps such as `conversation-side-panel-icons.ts` and `chat-workspace-heading-toolbar.tsx` still need migration         |
| Allow publisher-provided PNG or SVG icons                                                         | Sections 2, 5.8, 13.1, 13.3, 15.6, and 19.4   | The author may choose a PNG or passive SVG; the TAP SDK validates and locks it, `zephyr-packages` transports it byte-for-byte, and the host renders only the verified candidate while failing closed on malicious content     |
| Preserve plural package/surface icon variants                                                     | Sections 5.8, 13.1, 15.6, and 19.4            | `packageIconAssets` and `surfaceIconAssets` retain ordered media/theme/size metadata; empty surface selection inherits package candidates; host selects by theme/size/DPR                                                     |
| Distinguish an empty app registry from unavailable/stale data                                     | Sections 2, 5.7, 13.1, 15.6, and 19.4         | Rail, channel launcher, and Settings show loading/empty/ready/stale/unavailable truthfully and expose retry without destroying cached usable data                                                                             |
| Persist user-defined pin ordering                                                                 | Sections 5.7, 13.1, 15.6, and 19.6            | Synchronized rank/reorder API and concurrent convergence tests; insertion/vector/query order is explicitly insufficient                                                                                                       |
| Repository-by-repository change ownership                                                         | Section 13                                    | Root plan; implementation PRs cite their owning section and avoid duplicate contracts                                                                                                                                         |
| Cross-repository release order and verification                                                   | Sections 14 and 15                            | Release checklist; core/Zephyr/workflow releases precede TAP pins and full E2E                                                                                                                                                |

Coverage result: every explicit requirement raised in the conversation is represented in this plan. Items needing a product/security choice are recorded in Section 16 rather than silently assumed.

## 18. Evidence and starting references

Local implementation/reference points:

- `core/packages/runtime-core/src/core.ts`
- `core/packages/runtime-core/src/type/plugin.ts`
- `core/packages/runtime-core/src/utils/hooks/pluginSystem.ts`
- `core/packages/runtime-core/src/module/index.ts`
- `core/packages/runtime-core/src/remote/index.ts`
- `core/packages/bridge/bridge-react/src/remote/RemoteAppWrapper.tsx`
- `tap-miniapps/manifest.tap.json`
- `tap-miniapps/apps/games/rslib.config.ts`
- `tap-miniapps/apps/playground/rslib.config.ts`
- `ze-agency-tauri/crates/tap-apps2-manifest/src/descriptor.rs` (target
  enum and broad contribution union; schema is not consumer evidence)
- `ze-agency-tauri/crates/zephyr-package-manager/src/package_installation.rs`
  (canonical source/trust/review/visibility/pricing/entitlement records and
  fail-closed validation)
- `ze-agency-tauri/crates/zephyr-package-manager/src/registry.rs` (legacy
  placeholder registry HTTP client, not the authoritative Marketplace RPC)
- `ze-agency-tauri/crates/zephyr-package-manager-tauri/src/acquisition.rs`
  (all six manual, always-Untrusted acquisition requests)
- `ze-agency-tauri/crates/zephyr-package-manager-tauri/src/commands.rs`
  (manual registration plus legacy registry commands; no canonical
  Marketplace resolution/install command)
- `ze-agency-tauri/crates/zephyr-package-manager-tauri/src/projection.rs`
  (host-selected desktop/mobile `ui.surface` and WebView-tool projection)
- `ze-agency-tauri/crates/zephyr-package-manager-tauri/src/follow_tag.rs`
  (verified OTA candidates intentionally staged until fresh-realm handoff)
- `ze-agency-tauri/crates/tap-apps2-platform/src/package_runtime.rs`
  (verified QuickJS execution currently accepts only tool contributions)
- `ze-agency-tauri/packages/sdk/src/config.ts` (legacy `defineApp` authoring
  contract remains UI/tools only)
- `ze-agency-tauri/packages/sdk/src/rspack/index.ts` (single-build target
  selection, locked ESM shell generation, and transactional multi-target
  release assembly)
- `ze-agency-tauri/apps/tauri/src/lib/miniapp-federation/supervisor.ts`
- `ze-agency-tauri/apps/tauri/src/lib/miniapp-federation/surface-runtime-adapter.ts`
- `ze-agency-tauri/apps/tauri/src/components/miniapps/federated-mini-app-frame-host.tsx`
  (one React-owned iframe/transport is the production fresh-realm OTA gap)
- `ze-agency-tauri/apps/tauri/src-tauri/src/lib.rs` and
  `ze-agency-tauri/apps/tauri/src-tauri/src/commands.rs` (shared desktop/mobile
  package manager setup and command surface plus native pause/resume/shutdown
  runtime transitions)
- `ze-agency-tauri/apps/tauri/src-tauri/core-miniapps/apps/figma/rslib.config.ts`
  and `course-demo/rslib.config.ts` (converted validation apps assemble distinct
  desktop and mobile remotes)
- `ze-agency-tauri/crates/tap-apps/src/manifest.rs`
- `ze-agency-tauri/crates/tap-apps/src/api.rs`
- `ze-agency-tauri/crates/tap-apps/src/store.rs`
- `ze-agency-tauri/apps/desktop/src/components/layout/workspace-chrome.tsx`
- `ze-agency-tauri/apps/desktop/src/components/layout/workspace-rail-model.ts`
- `ze-agency-tauri/apps/desktop/src/components/layout/new-sidebar/new-sidebar.tsx`
- `ze-agency-tauri/apps/desktop/src/components/layout/chat-panel-controls-toolbar.tsx`
- `ze-agency-tauri/apps/desktop/src/components/layout/conversation-side-panel-tabs.tsx`
- `ze-agency-tauri/apps/desktop/src/components/layout/conversation-side-panel-icons.ts`
- `ze-agency-tauri/apps/tauri/src/hooks/use-workspace-apps.ts`
- `ze-agency-tauri/apps/tauri/src/queries/miniapp-pins.ts`
- `ze-agency-tauri/workers/chat-api/src/rpc/miniapp-pins.ts`
- `ze-agency-tauri/workers/chat-api/src/routes/connect-rpc.ts`
- `ze-agency-tauri/packages/chat-database/src/schema/miniapp-pins.ts`
- `ze-agency-tauri/protos/proto/tap/chat/v1/chat_api.proto`
- `ze-agency-tauri/packages/stores/src/panel-store.ts`
- `ze-agency-tauri/crates/tap-permissions/src/types.rs`
- `ze-agency-tauri/crates/tap-tool-runtime/src/lib.rs`
- `ze-agency-tauri/packages/authz-policy/src/role-permission-matrix.ts`
- `ze-agency-tauri/apps/tauri/src/features/rich-chat/types.ts`
- `ze-agency-tauri/apps/tauri/src/features/rich-chat/schema.ts`
- `ze-agency-tauri/apps/tauri/src/features/rich-chat/custom-components/registry.ts`
- `ze-agency-tauri/crates/tap-mcp/src/types.rs`
- `tap/apps/tap/src/app/tasks/task-model.ts`
- `tap/apps/tap/src/app/tasks/task-events.ts`
- `tap/docs/feature-rich-chat-rendering.md`
- `tap/docs/feature-mcp-connectors.md`
- `tap-miniapps/apps/games/manifest.tap.json`
- `tap-miniapps/apps/playground/manifest.tap.json`
- `zephyr-cloud-io/packages/api/api-shared/src/schemas/organization.schema.ts`
- `zephyr-cloud-io/apps/api/src/routes/organizations/organization.handlers.ts`
- `zephyr-panel/src/shared/utils/live-reload-socket.ts`

PR #5881-specific evidence was also inspected directly at the fetched `origin/pr-5881` ref, including its `tap-apps2-manifest` bundle/reference schema, SDK `UIEntrypoint`, platform UI-surface projection, workspace rail renderer, mini-app settings, and workspace mini-app route. Those files are intentionally not presented as current-working-tree paths when they do not exist on `main`.

External references:

- [PR #5881](https://github.com/ZephyrCloudIO/ze-agency-tauri/pull/5881)
- [PR #3891](https://github.com/ZephyrCloudIO/ze-agency-tauri/pull/3891)
- [MCP Apps overview](https://modelcontextprotocol.io/extensions/apps/overview)
- [MCP Apps stable specification](https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx)
- [Cloudflare D1 limits](https://developers.cloudflare.com/d1/platform/limits/)
- [Cloudflare D1 Worker binding API](https://developers.cloudflare.com/d1/worker-api/d1-database/)

## 19. Current implementation audit and remaining delivery boundaries

This is the authoritative implementation snapshot for this document. It
distinguishes locally proven behavior from descriptor vocabulary and future
control-plane work. The historical snapshot retained in Appendix A is
superseded and must not be used to infer current support.

### 19.1 Repository ownership and current state

| Repository                                              | Implemented in this effort                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Work that still belongs here                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ze-agency-tauri`                                       | Canonical validated, digest/SRI-locked descriptor/graph; all six manual source resolvers; recursive pinned parent collections; typed trust/review/listing/price/entitlement validation; ESM multi-target assembly; desktop/mobile target projection; portable loopback asset broker; exact WebView and QuickJS authority; target-scoped readiness; durable UI/QuickJS checkpoints; lifecycle and event brokers; Apps rail/pins; PNG/passive-SVG presentation; converted Design Viewer and Kent course packages | Cryptographic publisher/listing-release signing and namespace ownership; authoritative Marketplace catalog/install/purchase APIs; production consumers for most contribution kinds; mobile frontend Apps/frame host and device acceptance; host `tap.*` event adapters; full role/delegation/consent propagation; production fresh-realm OTA and cross-release checkpoint migration |
| `core`                                                  | Local runtime application hooks for `prePause`, `pause`, `preResume`, `resume`, and lifecycle errors; ESM remote-entry type preservation                                                                                                                                                                                                                                                                                                                                                                       | Publish these local commits and replace the product compatibility seam with a released dependency; broader TAP phases remain TAP-owned                                                                                                                                                                                                                                              |
| `tap-miniapps`                                          | Federated Games/Playground packages, collection fixtures, plural PNG/SVG roles, lifecycle ABI verification, and a physical local-Zephyr publish/follow-tag proof                                                                                                                                                                                                                                                                                                                                               | Add fixtures as each currently schema-only contribution gets a real host consumer                                                                                                                                                                                                                                                                                                   |
| `zephyr-packages`                                       | Propagates the `tap-app` target and ESM/manifest integrity through local Rsbuild/Rspack publication                                                                                                                                                                                                                                                                                                                                                                                                            | Release the changed packages; descriptor and asset-lock assembly correctly remain in the TAP SDK rather than this generic plugin                                                                                                                                                                                                                                                    |
| `zephyr-cloud-io`                                       | Accepts `tap-app` publications, resolves a followed tag to an immutable snapshot, and issues five-minute application-scoped live-reload credentials through authenticated Cerbos policy; Socket.IO verifies the exact app and rejects literal `*` browser CORS while retaining explicitly configured origin patterns                                                                                                                                                                                           | Production deployment/client release, TAP client ticket renewal/rejoin integration, Zephyr publication-namespace proof, and Zephyr organization-profile/logo binding. Marketplace publisher/listing services remain product-owned                                                                                                                                                   |
| `tap-e2e`                                               | Source preflight, SRI, icons, pins, retained lifecycle, converted apps, and atomic QuickJS fixture coverage on the feature branch                                                                                                                                                                                                                                                                                                                                                                              | Live CEF/web execution in a credentialed environment, full six-source acceptance, Marketplace/payment, native mobile, and future contribution consumers                                                                                                                                                                                                                             |
| `ze-workflows`                                          | Remains the canonical workflow/node/sidecar authority; no duplicate product-side engine was introduced                                                                                                                                                                                                                                                                                                                                                                                                         | Implement and release the Federation workflow-host adapter here first, then update the product-side pin/host adapter                                                                                                                                                                                                                                                                |
| `tap`, `zephyr-panel`, `zephyr-mono`, `zephyr-examples` | Research/reference inputs only in this tranche                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Change only if a later compatibility, notification, or generic example requirement cannot be owned by the repositories above                                                                                                                                                                                                                                                        |

### 19.2 What is executable now

- A package release currently uses a host-validated static descriptor plus
  immutable digest/SRI target locks. Cryptographic publisher and
  listing-release signatures are a remaining Marketplace authenticity layer.
  Module Federation is the common executable layer, not the trust or
  entitlement authority.
- Bundled-repository, npm, GitHub, local ZIP, local directory, and Zephyr
  sources converge on the same acquisition transaction. Every manual source
  is forced to `Untrusted`; callers cannot self-assert Marketplace or Official
  provenance.
- A remote parent collection can recursively reference pinned children with
  `{"url":"https://…/child.tap.json","hash":"sha256-…"}`. Expansion is
  bounded to depth 16, 256 manifests, 128 packages, 10 MiB per manifest, and
  64 MiB total; cycles, duplicate sources/package IDs, unpinned descendants,
  and integrity drift fail before an installable graph is returned. Pinned
  relative child URLs are not yet representable.
- The SDK emits native ESM Federation entries for Desktop, Mobile, QuickJS,
  Worker, Node, and WorkflowHost target profiles and assembles collision-free
  `targets/<target>` graphs transactionally. Desktop WebView surfaces and
  QuickJS tools are the material runtime consumers today. Worker, Node, and
  WorkflowHost are build/descriptor profiles until their owning host adapters
  land.
- QuickJS creates one isolate/container per exact immutable release, verifies
  and evaluates every selected expose, registers only authorized tools, and
  participates in the package readiness/rollback transaction. It is not yet a
  general background worker: timers, host futures, network, and filesystem
  capabilities remain intentionally absent.
- Every descriptor-backed UI surface now requires a compatible lifecycle
  expose on every selected target. A target/container—not each on-demand child
  surface—is the UI readiness unit, so a parent package with ten apps does not
  deadlock waiting for every route/channel placement to be opened. QuickJS is
  an independent readiness barrier.
- Durable checkpoints are exact to installation, release, and a host-derived
  runtime slot. Values are canonical JSON bounded to 32 KiB and 128 records.
  UI checkpoint services never disclose the native slot to remote code; cold
  restore remains hidden through `preResume`/`resume`, and a pending release
  cannot reveal UI or publish events before confirmation. Native suspend,
  resume, and shutdown drive actor-owned package runtime transitions.
- Checkpoint database failure is not treated as “no checkpoint.” A durable
  QuickJS candidate rolls back and an affected last-known-good runtime stays
  unavailable. UI checkpoint command failures similarly prevent reveal and
  confirmation.
- Accepted package events are host-stamped as
  `tap-pkg.<effective-namespace>.<local-name>` and automatically fan out only
  to active, exact, declared, same-scope subscribers. For an Official package
  namespace `planetscale`, the result is `tap-pkg.planetscale.*`; Untrusted
  packages use a host-derived quarantine namespace. The broker exposes a
  typed host-event delivery seam, but adapters from the product's canonical
  `tap.*` event sources are still required.
- Permission descriptors model actions, levels, Human/Specialist actors,
  autonomy, risk, and consent. Exact WebView/QuickJS tool registration and
  dispatch are enforced. Permission catalogs are not yet registered into the
  complete inherited-role/delegation system, so schema coverage must not be
  mistaken for full policy integration.

### 19.3 Contribution coverage: declaration versus consumer

The descriptor can declare all requested families: UI surfaces/renderers,
chat blocks, commands, prompts, skills, tools, specialists, task types,
attributes, views, actions and templates, workflows, workflow nodes,
automation triggers, MCP servers/tools/prompts/resources/resource templates/
Apps, composed mini apps, connectors, browser extensions, Knowledge Garden
plots/sources/enrichers/retrievers, provider adapters, templates, and
permission catalogs.

Production consumers remain narrower:

| Contribution family          | Current status                                                                                                                                |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `ui.surface`                 | Executable in the desktop frame host; backend target selection and portable artifacts support mobile, but the mobile frontend host is missing |
| `tool`                       | Executable with exact authority in WebView and QuickJS                                                                                        |
| lifecycle and package events | Executable shared infrastructure; canonical host-event adapters remain                                                                        |
| permission catalog           | Statically validated and used by tool authority; not a complete role-registry consumer                                                        |
| all other listed families    | Typed descriptor vocabulary only until an atomic registry/execution/unregister adapter lands in its canonical owner                           |

Workflow and node consumers must be implemented in `ze-workflows` first.
Chat blocks must preserve a durable fallback and use the declared TAP
primitives, isolated HTML, federated view, or MCP Apps protocol; none of those
renderers is production-registered by this package system yet.

### 19.4 Navigation, icons, and converted apps

- Desktop navigation has the requested separator and host-owned `Blocks` Apps
  control below Tasks, bounded direct workspace pins, and channel-specific pins
  in the channel Apps selector. Pin identity is installation + contribution,
  not mutable release or display name.
- Package authors define icon candidates in
  `presentation.assets`/`presentation.iconAssets`; a UI contribution may
  override with `options.iconAssets`. Accepted icon media are PNG and passive
  SVG, with locked SRI, size, theme, and role. Roles are `app-icon`,
  `publisher-icon`, `organization-icon`, `marketplace-card`, and `wordmark`.
- App/surface launcher icons come only from host-validated, digest/SRI-locked
  `app-icon` candidates. Publisher and organization assets inside a package are
  digest/SRI-locked release snapshots, not Marketplace identity proof. The future verified publisher
  profile is the authority for organization branding; workspace avatars remain
  workspace-owned.
- Design File Viewer and Kent CourseStudio are substantive assembled
  desktop/mobile packages with distinct remotes and restricted target-specific
  tools. They are not yet end-to-end mounted on mobile because that frontend
  host is missing. Kent still uses an explicitly named placeholder SVG because
  the final logo was not present in the supplied files; replacing it with a
  locked PNG or passive SVG is a normal release change.

### 19.5 Update and development truth

- Pinned and next-launch activation are deterministic. Follow-tag development
  publishes new immutable snapshots without rebuilding TAP and detects tag
  movement.
- The local proof publishes Playground twice through locally built
  `zephyr-packages`, resolves `local-follow` from snapshot `000001` to
  `000002`, observes the reload event, and re-verifies the descriptor, ESM
  entry, Federation manifest, target lock, all assets, icon roles, lifecycle,
  and module ABI. This is a real package/plugin/snapshot/tag proof against a
  loopback Zephyr service, not a production-cloud receipt.
- Product OTA intentionally remains staged for next launch. Exact candidate
  verification, target readiness, activation-pending authority quarantine,
  bounded exact-release checkpoints, and actor rollback are implemented
  foundations. A true live swap still needs their integration across distinct
  concurrently retained old/candidate realms, host-owned cross-release
  checkpoint migration, atomic CAS promotion/route switch, and crash recovery.

### 19.6 Required follow-up gates

1. Build the descriptor-backed Marketplace successor to PR #3891: verified
   publisher profiles, Official review/audit, public/private-self/private-
   workspace listings, free/paid offers, purchase/seat/revocation, signed
   entitlement issuance, and an authoritative catalog install RPC.
2. Release/pin the local Module Federation core changes.
3. Implement fresh-realm update and explicit cross-release checkpoint
   migration before enabling live OTA.
4. Add the mobile Apps/pins/routes/frame host and run native iOS/Android
   acceptance for Design Viewer and Kent.
5. Add canonical consumers and deterministic unregister/rollback for each
   schema-only contribution family, with workflow/node work starting in
   `ze-workflows`.
6. Connect canonical host `tap.*` events to the package event broker and add
   QuickJS event delivery/lifecycle publication.
7. Carry inherited roles, exact resource authority, Human/Specialist
   delegation, autonomy leases, and once/fresh consent attestations through
   execution.
8. Consume the short-lived Zephyr follow credential from TAP, renew/rejoin
   before expiry, add missed-event polling, and prove the tag resolver and
   notification path against real cloud services. The current bearer ticket is
   issued after principal authentication and application authorization, records
   that principal in signed `sub`, and binds the exact `application_uid`; the
   consuming socket is not independently principal/session-bound. Before private
   package GA, bind issuance and room join to the exact organization/project/
   application plus environment and followed tag, and add bounded replay/session
   controls. Do not snapshot-bind a follow ticket: each authorized event names
   the new immutable snapshot, after which TAP must recheck the installation,
   entitlement, and activation policy before loading it.
9. Run the live web/CEF suite once Auth0 credentials, matching web UI, deployed
   pin service, and a current automation binary are available; then add the
   full source, Marketplace, mobile, and contribution-family matrices.
10. Add cryptographic descriptor/listing-release signing, publisher key
    rotation and revocation, reserved namespace ownership proof, and an exact
    binding between signed bytes, reviewed listing release, and entitlement.

### 19.7 Validation receipts

- Product Rust: 34 descriptor tests, 62 recursive-loader tests, 48 package-
  manager tests plus the 10 focused release/readiness cases, focused clippy,
  Rust formatting, and canonical binding generation pass. The binding generator
  compiled the application graph and emitted the checkpoint request/response
  commands and recursive `MiniAppSource` schema used by both generated clients.
- Product TypeScript: the full Tauri app typecheck passes. The focused UI
  checkpoint/release-gate suite passes 28 tests, SDK suite 55, surface fixture
  suite 34, and event broker suite 5; targeted lint, formatting, capability
  ownership (4,994/4,994 tagged, with the same 13 documented mixed-runtime
  warnings), and diff checks pass.
- Native cross-target source checks were attempted, not silently skipped. iOS
  simulator compilation stops in the upstream CEF sys build because
  `aarch64-apple-ios-sim` is unsupported; Android compilation stops because
  this machine has no `aarch64-linux-android-clang`/NDK toolchain. Device
  acceptance therefore remains gate 4 above.
- `tap-miniapps`: `pnpm proof:local-zephyr` passes with two real locally built
  ESM `tap-app` snapshots and a followed-tag reload from `000001` to `000002`,
  including descriptor, manifest, target-lock, asset, icon-role, lifecycle,
  ABI, typecheck, and package-test verification.
- `zephyr-cloud-io`: 13 focused live-reload authorization tests, API and SDK
  typecheck/lint/build, and the complete eight-task API build pass.
- `tap-e2e`: 395 Rstest plus 9 Node unit checks, TypeScript/diff checks, and
  discovery of 9 mini-app Playwright scenarios pass. An actual CEF launch is
  blocked by missing Auth0 credentials and a matching automation binary and is
  not reported as green.
- The conversation coverage table in Section 17 was re-audited after the PNG/
  SVG addition. Every explicit request is represented; the gaps above are
  implementation boundaries, not missing plan items.

## Appendix A. Superseded implementation snapshot

The material below is retained only as the earlier audit trail. It predates the
recursive remote collection loader, target-generic mobile backend, portable
asset broker, substantive Kent conversion, durable runtime checkpoints,
target-scoped readiness, and UI checkpoint/release gates. Where it conflicts
with Section 19, Section 19 is authoritative.

This historical section distinguished implemented behavior from then-current
schema-only and control-plane work.

### A.1 Repository status at the earlier audit

| Repository        | Implemented or in the current validation tranche                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Still required for the complete plan                                                                                                                                                                                                                                                                                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `core`            | Typed application lifecycle hooks for `prePause`, `pause`, `preResume`, `resume`, and lifecycle errors; ESM remote-entry type preservation; runtime tests/build/lint                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Publish/release the local runtime commits and update normal dependency pins once review is complete                                                                                                                                                                                                                                                                                        |
| `zephyr-packages` | `tap-app` build context/target, Federation manifest preservation, descriptor/asset-lock publication inputs, and local plugin linkage                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Production release of the package plugin and any Marketplace-specific publication metadata agreed with the control plane                                                                                                                                                                                                                                                                   |
| `zephyr-cloud-io` | `tap-app` accepted as a Zephyr publication target; authenticated application-policy-gated API resolves an organization/project/application/tag to an available immutable snapshot and bounded descriptor URL/SRI (`2f460a2`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Production deployment validation, SDK/client release, authenticated follow-tag notification contract, publisher namespace proof, and the verified organization-logo pipeline                                                                                                                                                                                                               |
| `tap-miniapps`    | Commit `3f508d8`: federated fixtures use explicit parent `presentation.iconAssets`, plural child surface references, and distinct package/publisher/organization asset paths. The physical-package local proof builds/verifies Games, publishes two Playground snapshots through the locally built SDK and Zephyr plugin, checks both immutable 14-asset graphs byte-for-byte, follows `local-follow` from `000001` to `000002`, then typechecks and verifies both package sources. A bounded SIGTERM smoke also proves temporary payload restoration.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Expand conformance fixtures to every standalone contribution consumer and a parent/child failure matrix                                                                                                                                                                                                                                                                                    |
| `ze-agency-tauri` | The verified package foundation plus authenticated Chat API v1 pin preferences: stable per-user installation/contribution pin IDs, release-independent workspace-rail and per-channel locations, deterministic ranks, independent revisions, exact-permutation CAS reorder, channel authorization, and conflict snapshots. Local installation pin authority was removed and schema v2 drops its unreleased field. Channel scopes require an exact canonical channel room and reject DMs/URL aliases; raw reorder arrays are bounded before generated schema traversal. The React shell uses independent user-keyed workspace/channel TanStack Query entries, joins them to locally verified surfaces, keeps workspace pins available when channel lookup fails closed, renders bounded direct pins plus Pinned/Available/Unavailable controls, moves within displayed groups while preserving the full permutation, exposes channel app pins in the conversation launcher, and keeps mutations lifecycle-neutral. D1 reorder is one set-based JSON update and remains eight statements at the 256-pin bound. The same tranche retains bounded PNG/SVG identity/selection, static descriptors, locked ESM targets, collection transactions, Untrusted provenance, permissions, QuickJS Federation execution, lifecycle/event brokers, and the converted Design File Viewer and Kent course. | Port #3891's approval/authz/audit intent to the descriptor-backed Marketplace successor, add the mobile host, production consumers for the broad contribution union, a real paid-entitlement path, verified publisher profiles/logos, the production fresh-realm OTA checkpoint broker, remaining Core/Marketplace/drag/overflow app-library UX, and production cloud validation           |
| `tap-e2e`         | Commits through `2ea2c81`: source-build preflight, fixture server, Chat API v1 pin helpers, page object, and dual-target scenarios cover install, SRI, authoritative workspace reorder, visible-order change, stale-revision conflict/refetch, lifecycle neutrality, two-channel isolation, retained lifecycle, Design, Kent, explicit parent light/dark SVGs, a distinct child PNG set, parent inheritance, Settings/package rendering, and selected theme/media assertions. A kernel-owned exclusive loopback listener serializes local processes and a shared non-canceling GitHub concurrency group serializes web/CEF workflows using the deployed QA account. Pre-run and `afterAll` cleanup remove namespaced fixture contribution residue across random installation IDs while preserving unrelated pin order; all loopback contribution IDs are package-prefixed and uniqueness-tested, and Design Viewer is not cleaned because it is never pinned. `pnpm test:unit` passes 395 shared Rstest tests plus six Node tests; full E2E TypeScript, focused lock/cleanup/miniapp tests, converted-artifact preflight, combined web/CEF Playwright discovery (16 tests), YAML parsing, formatting, and diff checks pass.                                                                                                                                                                | Execute the live web/CEF scenarios once populated Auth0 credentials, a matching `tap-ui` implementation/build, deployed Chat API pin service, and a freshly built matching CEF automation binary are available; replace shared-account serialization with isolated run workspaces/accounts or a backend lease; add mobile and Marketplace/control-plane projects when those surfaces exist |
| `ze-workflows`    | Inspected as the canonical workflow authority; no source change was needed for the verified UI/QuickJS slice                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Add and release the workflow-host package consumer before claiming federated workflow/node execution end to end                                                                                                                                                                                                                                                                            |

The scoped product validation is green: SDK build/typecheck and 79 tests;
32 descriptor tests; all 29 package-manager tests; 46 changed-surface app
tests; all 664 desktop tests; both converted package builds, typechecks, and
tests; Rust and repository formatting; lint over 3,129 files; strict capability
ownership; and diff checks. An additional full Tauri-app run passed 4,946 of
4,948 tests and exposed two out-of-scope baseline/environment failures: one
missing CanvasKit WASM install path and one existing completed-course restore
assertion. Neither failing file is changed by this tranche, so a full-suite
green result is not claimed.

The final authoritative-pin integration commit is `1a27b50cd`. Its canonical
binding generation completed successfully; all 52 TypeScript workspace
packages typecheck; the focused Chat API pin suite passes 10 tests, the rail/
settings pin suite passes 30, and the channel launcher suite passes 26. Full
lint reports zero findings across 3,132 files, Rust formatting, capability
validation, Knip, and diff checks pass. Capability validation retains only the
13 documented pre-existing mixed-runtime warnings.

### A.2 Earlier local publication receipt

`tap-miniapps` contains `pnpm proof:local-zephyr`. The proof temporarily
installs physical copies of the locally built SDK, Zephyr plugin payloads, and
their required SDK runtime dependencies into both source packages. It builds
and verifies Games, builds and publishes Playground twice through the real
plugin into a loopback implementation of the Zephyr upload/snapshot/tag
contract, follows `local-follow`, and observes the tag move from snapshot
`000001` to `000002`. It verifies:

- Zephyr build target and context are both `tap-app`.
- The executable entry is native ESM `remoteEntry.mjs` with an
  `mf-manifest.json`.
- All fourteen locked assets match both byte length and SHA-256 SRI; every
  presentation role retains nonempty size/theme metadata and the exact
  asset-lock integrity, the parent selection is explicit/unique and contains
  only declared `app-icon` assets, and UI surfaces use only plural
  `iconAssets` references to declared child assets.
- The followed tag resolves immutable snapshots rather than serving mutable
  tag bytes as runtime identity.
- The reload notification follows the new snapshot without rebuilding TAP.
- Both Games and Playground typecheck and pass their package graph verifier
  while the local payloads are installed.
- Temporary physical package replacements, backups, `HOME`, loopback server,
  and proof directory are restored after the proof, including an orderly
  signal-interruption path.

This is a deterministic local integration receipt, not a production-cloud
receipt. It substitutes only the Zephyr network services; the package build,
plugin publication, upload, snapshot, resolve, and reload paths are real.

### A.3 Earlier converted-package status

The Design File Viewer and Kent's Product Engineering course each build as a
descriptor-backed ESM Federation package with a locked surface shell,
`remoteEntry.mjs`, Federation manifest, asset lock, lifecycle expose, UI
surface, and declared tools. Both start Untrusted and deny package actions
until the host persists the minimum matching human grant. Their target depth is
not yet equal:

- Product commit `0be7528c0` makes Design File Viewer one assembled dual-target
  package with distinct desktop and mobile ESM remotes. Both adapters mount the
  substantive raw-`.fig` viewer and retain conversation scope. Desktop exposes
  eight exact tools plus the narrow browser/Figma host module; mobile exposes
  exactly seven read/select/update tools and does not expose, register, or
  activate Save Copy or browser operations. Direct dual-target Zephyr publish
  requests fail before partial output until the assembled-package publisher
  lands. Its 11 focused tests, typecheck, portable artifact scan, isolated
  target locks, remote imports, and full package assembly pass.
- The course package currently exposes a desktop workspace surface, catalog
  tool, and separately permissioned editor-open host action. Its present
  compatibility content is not yet the substantive Course Studio runtime and
  it has no mobile remote; that conversion remains active work rather than a
  completed validation claim.
- The Kent logo referenced in the implementation request was not present in
  the supplied files. The package therefore uses a clearly named placeholder
  SVG so it cannot be mistaken for final brand artwork; replacing that locked
  asset with the intended PNG or SVG is a release-only change.

### A.4 Earlier icon and logo status

- A package descriptor defines a bounded ordered `presentation.assets` table.
  Roles currently include `app-icon`, `publisher-icon`,
  `organization-icon`, `marketplace-card`, and `wordmark`; both `image/png`
  and `image/svg+xml` are first-class. The author may choose a PNG or a passive
  SVG for each package, collection, or contribution icon; neither format is a
  fallback-only compatibility path, and one package may mix them across
  candidates. The descriptor permits at most 64
  presentation assets and 16 `app-icon` variants for a package or surface.
- `presentation.iconAssets` explicitly selects the ordered parent package or
  collection candidates. UI contributions use plural `options.iconAssets`;
  omitting that child selection inherits the parent set. The projection keeps
  the two identities separate as `packageIconAssets` and `surfaceIconAssets`,
  so artwork for one child cannot replace collection artwork. Older packages
  without a parent selection inherit all declared `app-icon` assets for
  compatibility. Candidate quotas apply per parent or surface rather than
  globally, allowing a collection of ten or more independently branded apps.
  Each candidate retains its isolated `assetUrl`, `mediaType`, `sizes`, and
  `theme`.
- SDK publication and host acquisition apply the same passive-SVG rejection
  policy. Acquisition verifies the locked asset SRI and media declaration,
  fully decodes bounded PNGs, requires one declared intrinsic PNG size that matches
  the decoded square dimensions, rejects trailing/polyglot bytes, and parses
  SVG as passive XML while rejecting scripts, event handlers, animation,
  style elements/attributes, external CSS string functions, foreign XML
  namespaces, `foreignObject`, external references/resources/fonts, entities,
  malformed roots, invalid UTF-8, and resource-exhaustion cases. Declared dimensions are bounded to
  4096 per edge; scalable SVG candidates use `sizes: [any]`.
- The package graph and renderer accept only package-origin asset URLs, and
  ambiguous percent-bearing descriptor paths/still-encoded remainders fail
  closed. The current source still relies on an HTTP-shaped
  `*.tap-miniapp.localhost` URL paired with a Tauri custom-protocol handler;
  that pairing has not been proven to serve browser HTTP requests and is not
  the portable desktop/mobile boundary. Section 5.9 therefore specifies the
  remaining ephemeral loopback broker with exact host/port/capability checks,
  media-aware CORP, restrictive CSP/Permissions Policy, and bounded GET/HEAD
  serving. Until that broker passes native desktop/iOS/Android acceptance,
  isolated asset serving is a known implementation gap. SVG bytes are never
  injected into the host DOM.
- Platform registration validates every candidate independently: URLs must
  share the surface's isolated origin, have no credentials/query/fragment,
  use the package or surface path prefix, retain nonempty valid sizes, match
  the `.png`/`.svg` media type, be unique in their set, and resolve to a real
  confined file inside the verified artifact root. Every surface for one
  package must expose the exact same package-level candidate set.
- Workspace rail pins, the workspace Apps selector/library, the channel Apps
  selector, Mini Apps Settings, and registered surface controls all use the
  same verified `MiniappPackageIcon` renderer and deterministic host
  `AppWindow` fallback. An arbitrary package URL is not passed to `<img>`.
- That renderer now selects from the plural candidates using the effective
  light/dark theme, rendered CSS size, and current DPR. Exact-theme candidates
  exclude `any` candidates when available; size ranking prefers exact fixed
  size, scalable `any`, nearest larger, then nearest smaller, with descriptor
  order as the final tie-breaker. Theme and DPR changes re-evaluate selection.
- The host Apps selector and channel Apps toggle are TAP chrome and always use
  the host `Blocks` glyph; a publisher cannot replace them.
- Registry consumers in the source-level validation tranche no longer equate
  query failure with an empty installation. The workspace Apps selector and
  Settings distinguish loading, legitimate empty, ready, stale cached data,
  and unavailable initial data and provide explicit retry states/anchors. The
  existing conversation launcher likewise has a bounded load-error retry.
- The E2E fixture now declares two parent-package scalable SVG variants
  (`light` and `dark`), distinct 16x16 and 32x32 child PNG variants, explicit
  surface selections, and one surface that inherits the parent set. Its Node
  contract checks order, role,
  theme, declared/decoded size, lock membership, and SRI; the dual-target spec
  checks package, SVG, PNG, selected theme, and inherited rendering. Harness
  unit tests, E2E TypeScript checking, and web/CEF Playwright discovery pass;
  a live target run is not claimed.
- A publisher/organization logo must come from a verified Marketplace
  publisher profile bound to immutable publisher/organization identity. The
  package may carry digest/SRI-locked `publisher-icon`/`organization-icon`
  presentation claims or release snapshots, but those roles do not create Marketplace
  verification and are not currently used as launcher icons. The profile
  upload, moderation, versioning, and immutable binding pipeline remains
  control-plane work.
- TAP workspace avatars remain workspace-owned and are never treated as a
  package or Marketplace publisher logo.

### A.5 Earlier incomplete-boundary list

The following are not yet production-complete and must not be inferred merely
from schema coverage:

1. PR #3891 is still open; the 2026-07-12 audit saw head `99800344e` in a
   dirty merge state. It targets legacy `tap-apps` ZIP/minisign artifacts, so
   it cannot merge unchanged. Official approval, public/publisher-private/
   workspace-private publication, paid offers, entitlement acquisition,
   Marketplace catalog installation, and verified publisher branding remain
   unwired until its useful approval/authz/audit model is ported to the typed
   descriptor-backed control plane.
2. Desktop `ui.surface` and WebView/QuickJS tool execution are the material
   contribution consumers in this slice. Permission catalogs participate in
   validation, but are not an independently executable consumer. Skills,
   specialists, workflows/nodes, MCP
   servers/apps/UI, tasks, browser extensions, Knowledge Garden modules,
   provider adapters, chat blocks, and the other declared families still need
   their canonical registries, execution adapters, and uninstall/update
   cleanup paths.
3. Desktop, mobile, QuickJS, Worker, Node, and workflow-host target shapes can
   be emitted by the SDK, and the verified QuickJS tool path is exercised.
   **Mobile is schema/build-only**: product setup and commands are desktop-
   gated, projection hardcodes `PackageTarget::Desktop`, the mobile command set
   omits the package manager/runtime, no mobile Apps routes or mount host exist,
   the converted Design/Kent packages expose desktop only, and there is no
   native mobile E2E. Production Worker/Node execution and the `ze-workflows`
   host consumer are likewise not end-to-end.
4. Pinned and next-launch release state is deterministic. A true OTA update
   must create a fresh candidate realm, run old `prePause`/`pause`, carry the
   checkpoint payload through a host-owned broker to candidate
   `preResume`/`resume`, health-check, atomically switch, and retain rollback.
   Merely replacing a document or reusing one iframe transport is
   insufficient; OTA must remain staged/fail closed until that handoff exists.
5. Live web/CEF acceptance was not rerun for the plural-icon/pin tranche: the
   E2E checkout has no populated Auth0 credentials or `tap-ui` checkout, and no
   freshly built packaged CEF binary matching the in-flight product changes.
   Moreover, web CI builds a separate `ZephyrCloudIO/tap-ui` checkout and calls
   the deployed-dev Chat API; equivalent web UI/transport changes and the pin
   service migration must land there before the new web scenarios can pass.
   The exact harness unit, TypeScript, Playwright-discovery, and diff checks in
   Section 19.1 are green; no live-launch result is claimed.
6. The immutable Zephyr tag resolver is implemented locally and policy-gated,
   but production-cloud deployment, generated client consumption, authenticated
   live-reload notifications, and reconciliation against real Zephyr services
   have not been validated. The loopback publication receipt in Section 19.2
   is not a production-cloud receipt.
7. Initial/stale registry failure and retry states, synchronized
   Pinned/Available/Unavailable sections, channel Core grouping, accessible
   reorder actions, and bounded direct pins are implemented at source level.
   The workspace Apps library still needs an explicit Core partition,
   drag-reorder/overflow polish, activity badges, and a capability-gated
   Marketplace acquisition link.
8. Package-tool authorization derives actor/execution/scope and enforces
   declared action grants at the canonical Rust executor. A complete
   consequential-action path still needs consumption of one-time or
   fresh-decision consent attestations plus exact resource identifiers and the
   current specialist autonomy/delegation context in `ToolContext`.
9. App-icon PNG/SVG validation, explicit parent-package versus child-surface
   projection, per-identity variant quotas, theme/size/DPR selection, exact
   single-decode serving, and fallback are implemented at source level.
   Marketplace-backed publisher/organization profile resolution and reviewed
   monochrome, high-contrast, wordmark, and card placement policy are not.
10. The requested final Kent course logo was not present among the supplied
    files. The converted package intentionally uses a placeholder SVG; final
    brand artwork may be either a locked PNG or SVG in a subsequent release.
11. Pin ordering is now synchronized per user with independent workspace and
    channel locations, stable IDs/ranks, revision-checked create/remove/reorder,
    and no release coupling. Remaining pin work is Marketplace/admin default
    policy, mobile presentation, uninstall confirmation/cleanup integration,
    and live execution of the new dual-target scenarios in a prepared runtime.
12. The reorder route rejects more than 256 raw `pinIds` before generated schema
    traversal, but the shared Connect helper still materializes the JSON body
    first. Cloudflare applies a platform request-size bound and authentication
    runs before the route; a tighter shared Connect byte/streaming limit remains
    desirable defense in depth against authenticated memory/CPU abuse.
13. The local kernel lock plus shared GitHub workflow concurrency closes known
    in-run and web/CEF CI races, but cannot coordinate a developer who runs the
    deployed suite locally with the same QA credentials. A backend lease or
    per-run account/workspace is the production-grade distributed test boundary.

### A.6 Earlier cross-boundary audit

These boundaries were re-audited against the current product source. Deferred
work remains explicit; the pin-ordering subsection records the boundary that
was completed after the original audit rather than leaving stale caveats.

#### Marketplace and PR #3891

- PR #3891 remains the source of useful official-approval/authz/audit design,
  but it is not a mergeable implementation boundary. Its audited 2026-07-12
  head is `99800344e`, GitHub reports a dirty merge state, and its acquisition
  flow is coupled to legacy `tap-apps` ZIP/minisign artifacts. It must be
  ported—not merged unchanged—to the canonical descriptor, graph lock, and
  immutable release model.
- The current package manager can acquire, verify, install, and label manual
  packages **Untrusted** through
  `crates/zephyr-package-manager-tauri/src/acquisition.rs:50-136` and
  `commands.rs:345-376`. It does not implement the approved catalog receipt
  that makes a listing Official. The older search/get/install commands in
  `commands.rs:690-830` call a placeholder `RegistryClient` configured at
  `commands.rs:122-127`; they do not produce a descriptor-backed Marketplace
  installation with review and entitlement evidence.
- Canonical validation types already exist in
  `crates/zephyr-package-manager/src/package_installation.rs:199-475`: a
  Marketplace source, Official/Untrusted trust, review attestation, public/
  private-user/private-workspace visibility, free/paid price, and free/paid
  entitlement. Lines 1475-1624 fail closed when source/review/listing/scope/
  offer evidence disagrees. This is valuable host-side validation, not a
  Marketplace database, payment authority, publisher profile, or install API.
- The successor must persist typed publisher/profile, listing, immutable
  listing release, team review/attestation, visibility grant, offer,
  entitlement, and install-resolution records. The authoritative install RPC
  resolves those records and returns the immutable descriptor/graph identity
  plus review/entitlement evidence to the same verified artifact transaction
  used by other sources. Public, publisher-private, workspace-private,
  paid/free, entitlement acquisition, catalog installation, quarantine/review
  provenance, and publisher-profile verification remain Marketplace/control-
  plane work.
- A future valid package signature or reserved namespace attestation, and a
  digest/SRI-locked `publisher-icon`/`organization-icon`, preserve provenance
  only. None of them
  may synthesize an Official badge, paid entitlement, or verified publisher
  profile before the #3891 successor contract supplies that evidence.

#### Persisted pin ordering

- The local release-coupled `ContributionPin` authority has been removed.
  Persisted installation schema v2 explicitly drops that unreleased field;
  activation, rollback, pause, and resume never rewrite navigation preferences.
- Chat API v1 now owns authenticated per-user records keyed by immutable
  installation/contribution identity and the exact workspace-rail or
  channel-selector location. Records contain no release ID. Every location has
  its own revision and fixed-width rank; create/remove and exact full-permutation
  reorder use an atomic mutation-token CAS batch and stale writers receive the
  canonical scope with an aborted conflict.
- Channel reads require an exact canonical channel identity, current channel
  access, and channel room kind; DMs and URL-normalized aliases fail closed.
  The client cache key includes the authenticated user, workspace, and optional
  channel, while workspace-only and optional channel reads use independent
  cache entries so a channel registry/access failure cannot blank valid rail
  pins. React joins synchronized snapshots to verified local surfaces and
  preserves missing or incompatible pins as unavailable preferences rather
  than silently reassigning them by slug, release, registration order,
  timestamp, or query arrival.
- Reorder rejects raw arrays over 256 before generated schema traversal and uses
  one parameterized `json_each` update for all ranks. The pin
  service executes a constant eight D1 statements even for the bounded 256-pin
  scope; route authorization adds only bounded queries, so the complete
  invocation remains below the Workers Free query budget.
- When resolved and unavailable pins render as separate groups, move controls
  swap adjacent displayed peers across hidden slots and still submit the exact
  complete server permutation; the E2E oracle asserts the visible rail order,
  not merely a server-side pin-ID change.
- Final security review of product `1a27b50cd` and E2E `2ea2c81` found no
  unfixed High or Medium issue in this tranche. The two Low defense-in-depth
  residuals are the shared Connect body-byte limit and a distributed E2E lease,
  both recorded in Section 19.5 rather than being misreported as complete.
- Unit/integration proof covers per-user and per-channel isolation, exact
  permutation validation, simultaneous same-revision writers, canonical
  conflict state, a 256-pin reverse with a three-statement mutation batch, UI
  cache/account isolation, route/standalone eligibility, unavailable pins, and
  lifecycle-neutral rendering. Dual-target E2E additionally covers persisted
  reorder and visible order, stale-client recovery, two-channel isolation,
  retained mounted state, crash/normal residue cleanup, cross-workflow
  serialization, and package-prefixed fixture contribution IDs; live runtime
  execution remains environment-gated as recorded above.

#### Mobile target: schema/build support only

- `PackageTarget::Mobile` exists beside Desktop, QuickJS, Worker, Node, and
  WorkflowHost in
  `crates/tap-apps2-manifest/src/descriptor.rs:731-743`. The SDK Rspack adapter
  accepts `packageTarget: "mobile"` and validates one selected build target in
  `packages/sdk/src/rspack/index.ts:116-128,1724-1782,1884-1926`. These facts
  prove schema and per-target build vocabulary only.
- The product host is desktop-only at the relevant boundary:
  `apps/tauri/src-tauri/src/lib.rs:162-167` gates the package-manager module,
  lines 1370-1395 gate mini-app platform setup, and
  `apps/tauri/src-tauri/src/commands.rs:1305-1339,1472-1530` place package
  manager/runtime commands in desktop command macros. The mobile runtime set at
  `commands.rs:1827-1845` contains none of them.
- Projection is not target-generic.
  `crates/zephyr-package-manager-tauri/src/projection.rs:38-199` directly
  selects `PackageTarget::Desktop`, accepts only
  desktop WebView UI surfaces/tools, and emits `target: "desktop"`. No trusted
  mobile target resolver or mobile package projection exists.
- Both converted validation packages are desktop-only:
  `core-miniapps/apps/figma/rslib.config.ts` and
  `course-demo/rslib.config.ts` set `packageTarget: "desktop"`, and their
  descriptors/contributions select only desktop exposes. There is no mobile
  Apps selector/route/mount host or native mobile acceptance suite in this
  tranche.
- The hard dependency chain is therefore: multi-target artifact assembly ->
  trusted host target projection/auth -> portable isolated WebView/Federation
  runtime -> mobile Apps/pins/routes/Settings -> real Design/Kent mobile entries
  -> native Appium acceptance. Until all six stages pass, mobile must continue
  to be described as schema/build-only.

#### Broad contribution union: schema versus executable consumers

- The validated descriptor union is intentionally broad:
  `crates/tap-apps2-manifest/src/descriptor.rs:821-1018` declares UI surfaces/
  renderers, chat blocks, commands/prompts/skills/tools/specialists, task
  families, workflows/nodes/triggers, MCP families/Apps, composed mini apps,
  connectors, browser extensions, Knowledge Garden families, provider adapters,
  templates, and permission catalogs.
- Executable integration is much narrower. The production projection in
  `crates/zephyr-package-manager-tauri/src/projection.rs:38-199` materializes
  desktop `ui.surface` contributions and their WebView tools. The verified
  QuickJS loader in `crates/tap-apps2-platform/src/package_runtime.rs:117-179`
  rejects every selected contribution except `tool`. The legacy author-facing
  `defineApp` contract in `packages/sdk/src/config.ts:5-65` likewise accepts
  only `ui` and `tools`. Permission catalogs feed host validation, and lifecycle
  and event brokers provide shared infrastructure, but none of those facts
  make the remaining contribution families executable.
- TAP already has separate skill, specialist, MCP, task, Knowledge Garden, and
  legacy/browser-extension authorities, while `ze-workflows` owns workflow/node
  execution. Package integration must adapt to those canonical registries with
  installation/release ownership, permission/event scope, update rollback, and
  deterministic unregister; it must not create parallel mini-app-only stores.
  The existing `MiniAppWorkflowActionSink` lets a mounted UI invoke a workflow;
  it is not a package-contributed workflow or node registry.
- The required consumer order is deliberate: production fresh-realm OTA first,
  then federated skill, specialist, canonical `ze-workflows` workflow/node,
  MCP/chat/rendering, tasks, Knowledge Garden contributions, and browser
  extensions last. Section 14.1 defines the exit gate for each step. This order
  establishes atomic ownership/rollback before expanding into registries with
  durable or native effects.

#### Publisher and organization profile logos

- Descriptor roles for `publisher-icon` and `organization-icon` are
  digest/SRI-locked release presentation data; Marketplace signing remains a
  gate. They are useful for provenance claims or
  publication snapshots but do not establish who controls the Marketplace
  publisher identity.
- Production needs a verified profile asset pipeline: upload, safe decode,
  content addressing, moderation, version/audit history, immutable publisher
  and optional Zephyr-organization binding, public read model, revocation, and
  historical publication snapshots.
- The known Zephyr organization `logoUrl` write/read gap and PR #3891's lack of
  a typed logo binding remain unresolved. TAP workspace avatars and arbitrary
  package URLs cannot fill this role.

#### Production fresh-realm OTA checkpoint handoff

- The abstract Federation supervisor already models serialized lifecycle
  transitions and rollback in
  `apps/tauri/src/lib/miniapp-federation/supervisor.ts:216-307,962-1100`, but
  the production surface factory in `surface-runtime-adapter.ts:229-249` wraps
  one fixed lifecycle transport for every release. The React host constructs
  that one transport/factory around one iframe at
  `components/miniapps/federated-mini-app-frame-host.tsx:269-333`; it does not
  create a distinct hidden candidate realm.
- A release URL/document replacement destroys the old document before a
  reliable old-realm `prePause` checkpoint can cross the boundary. The current
  checkpoint is only an opaque reference; example packages retain payloads in
  realm-local maps, while each immutable release receives a different origin.
- Follow-tag `ota` therefore stages safely for next launch. It must not be
  described as live OTA; the explicit fail-closed staging behavior is in
  `crates/zephyr-package-manager-tauri/src/follow_tag.rs:483-499`. Live OTA
  requires a Rust-owned transaction that provides: a trusted
  candidate projection lease without first changing active state; distinct
  old/candidate iframe or isolate transports; a bounded, schema-validated,
  identity-bound checkpoint payload broker; candidate event/tool/ACL
  quarantine; package-wide coordination across mounted surfaces; CAS commit
  only after candidate `preResume`/`resume`; rollback/crash journaling; and a
  bounded old-realm retention window.
- Required validation includes old `prePause` timeout/veto, malformed or
  oversized checkpoint, wrong release/instance handle, candidate ready/mount/
  `preResume` failure, DB-CAS failure, crash at every phase, multi-surface
  partial failure, authority promotion/revocation, and proof that React query
  refresh does not navigate away the retained old realm mid-handoff.
- This transaction is the first dependency in the remaining contribution lane,
  not optional polish. Every new registry consumer needs the same staged owner,
  candidate quarantine, atomic promotion, rollback journal, and deterministic
  cleanup contract; implementing broad contributions first would duplicate or
  bypass those guarantees.
