---
name: zephyr-core
description: Use when the user asks about Zephyr setup, with-zephyr, SDK selection, Change Attribution, human/AI contributions, dirty-source version differences, versions, tags, environments, snapshot/version URLs, dashboard workflows, docs, or public env vars.
license: Apache-2.0
metadata:
  author: Zephyr Cloud IO
  purpose: Use when the user asks about Zephyr setup, with-zephyr, SDK selection, versions, tags, environments, snapshot/version URLs, dashboard workflows, docs, or public env vars.
  domain: sdk
  type: core
sources:
  - ZephyrCloudIO/zephyr-packages:**/skills/zephyr-core/references/*.md
  - ZephyrCloudIO/zephyr-packages:**/scripts/sync-package-skills.mjs
  - ZephyrCloudIO/zephyr-packages:**/libs/with-zephyr/src/attribution.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/with-zephyr/hooks/*.cjs
  - ZephyrCloudIO/zephyr-packages:**/libs/with-zephyr/src/index.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/with-zephyr/src/rstack.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/with-zephyr/src/bundlers/rstack.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/with-zephyr/src/bundlers/index.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/with-zephyr/src/engine/ast-grep.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/with-zephyr/src/operations.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/with-zephyr/src/types.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/with-zephyr/src/tests/bundler-configs.test.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/with-zephyr/src/tests/rstack.test.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/with-zephyr/src/tests/rstack-inheritance.test.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/with-zephyr/src/tests/codemod.test.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/with-zephyr/src/tests/attribution.test.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/with-zephyr/README.md
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-agent/src/lib/change-attribution/*.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-agent/src/lib/transformers/ze-build-snapshot.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-agent/src/lib/transformers/ze-build-dash-data.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-agent/src/zephyr-engine/index.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-edge-contract/src/lib/change-attribution.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-edge-contract/src/index.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-edge-contract/src/lib/snapshot.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-edge-contract/src/lib/zephyr-build-stats.ts
  - ZephyrCloudIO/zephyr-packages:**/scripts/verify-change-attribution.mjs
  - ZephyrCloudIO/zephyr-packages:**/scripts/verify-live-attribution.mjs
  - ZephyrCloudIO/zephyr-packages:**/scripts/verify-attribution-storage.mjs
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-agent/src/index.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-agent/src/lib/http/http-request.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-agent/src/lib/http/http-request.test.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-agent/src/lib/http/fetch-with-retries.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-agent/src/lib/http/fetch-with-retries.test.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-agent/src/lib/node-persist/upload-provider-options.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-agent/src/zephyr-engine/__test__/upload_assets.test.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-edge-contract/src/lib/api-contract-negotiation/get-api-contract.ts
---

# Zephyr Core

Use this skill for Zephyr SDK adoption and build-integrated deployment. It ships
with every published Zephyr package, including supporting libraries that are not
themselves build plugins. Do not assume the package containing this guide exports
`withZephyr`; choose the actual integration for the application's stack.

Prefer a more specific skill shipped alongside this one for its supported task,
such as `zephyr-vite` or `create-zephyr-apps`. Check the installed integration's
README, exported types, and peer compatibility before applying code examples.

Zephyr is a build-integrated deployment platform for frontend and frontend-adjacent apps: it plugs into the build, publishes immutable versions, and lets users route traffic through tags and environments.

## What to cover

- Start with the smallest useful answer.
- Prefer Zephyr's user-facing model first: setup -> build -> version URL -> tags/envs -> promote/rollback.
- Use repo/code-path nuance only when it clarifies behavior or corrects docs drift.
- If the question is really about remote resolution, hosts/remotes, `zephyr:dependencies`, or multi-bundler Module Federation, switch to `../zephyr-module-federation/SKILL.md`.
- First-time users usually need: a supported stack or fallback upload path, Zephyr auth/account access, and git metadata for repo/branch/commit identity.

## What Zephyr does

- Zephyr integrates with the build and publishes immutable frontend versions.
- Zephyr gives users permanent version URLs plus mutable tags and environments.
- Zephyr can manage public runtime config overrides and deployment routing.
- Zephyr does not replace the app's own framework/bundler config; it integrates into it.
- Zephyr does not make public `ZE_PUBLIC_*` values secret.

## Core mental model

- Zephyr plugs into the app build through a bundler/framework integration.
- A build creates an immutable version/snapshot and a permanent version URL.
- Tags and environments are mutable pointers on top of immutable builds.
- Promotion and rollback are mostly pointer changes, not rebuilds.
- `ZE_PUBLIC_*` values can be captured at build time and overridden per environment later.

## Answer flow

1. Identify the user's stack and deployment goal.
2. Read `references/sdk-setup.md` for setup guidance.
3. Read `references/deployment-model.md` for versions, snapshots, tags, envs, and dashboard workflows.
4. Read `references/env-vars.md` if the task mentions env vars, runtime config, build once deploy everywhere, or `ZE_PUBLIC_*`.
5. Read `references/examples-resume.md` when the user wants concrete starter patterns.
6. Read `references/docs-map.md` when deeper docs links are useful.
7. Read `references/troubleshooting.md` when setup/build/auth/git issues appear.
8. Read `references/change-attribution.md` for optional tracking, agent/editor hooks,
   source fingerprints, and version comparisons involving local changes. Obtain
   explicit opt-in before enabling capture or installing hooks.

## Source priorities

- Canonical public docs: `https://docs.zephyr-cloud.io`
- Raw docs path pattern: `https://docs.zephyr-cloud.io/<path>.md`
- Docs index: `https://docs.zephyr-cloud.io/llms.txt`
- Community help: `https://discord.gg/zephyrcloud`
- Architecture docs: `https://docs.zephyr-cloud.io/reference/architecture.md`
- Public docs source: `https://docs.zephyr-cloud.io`
- Examples source: `https://github.com/ZephyrCloudIO/zephyr-examples`

## Guardrails

- Do not invent SDK names; verify against `references/sdk-setup.md`.
- Do not blur version vs tag vs environment; explain the distinction plainly.
- Do not present `ZE_PUBLIC_*` as secret storage. They are public client-facing values.
- Call out docs drift when relevant instead of silently repeating conflicting details.
