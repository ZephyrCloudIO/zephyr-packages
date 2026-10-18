---
name: zephyr-core
description: Set up, deploy, and debug Zephyr in a frontend project. Use when adding or configuring a Zephyr bundler or framework integration (Vite, webpack, Rspack, Rsbuild, Rollup, Rolldown, Parcel, Metro, Re.Pack, Astro, Modern.js, Nuxt, Rspress, TanStack Start, Vinext), running with-zephyr, diagnosing why a build did not publish, or asking about versions, tags, environments, snapshot/version URLs, dashboard workflows, docs, or ZE_PUBLIC_* env vars.
license: Apache-2.0
metadata:
  author: Zephyr Cloud IO
  purpose: Set up a Zephyr integration for the application's stack and explain Zephyr's deployment model.
  domain: sdk
  type: core
---

# Zephyr Core

Use this skill for Zephyr SDK adoption and build-integrated deployment. Choose
the integration for the application's actual stack, then read only that
stack's guide below. Check the installed integration's README, exported types,
and peer compatibility before applying code examples.

Use `create-zephyr-apps` to scaffold a new project and `zephyr-cli` to publish
a stack without a bundler integration.

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

## Configure the integration

Identify the stack from the project's build config files and installed
packages, then read the matching guide. Framework integrations take precedence
over the bundler they build on: use the TanStack Start or Vinext guide rather
than the Vite guide, and Modern.js or Rspress rather than Rsbuild.

| Stack          | Package                             | Guide                                                          |
| -------------- | ----------------------------------- | -------------------------------------------------------------- |
| Vite           | `vite-plugin-zephyr`                | [vite.md](references/integrations/vite.md)                     |
| TanStack Start | `vite-plugin-tanstack-start-zephyr` | [tanstack-start.md](references/integrations/tanstack-start.md) |
| Vinext         | `vite-plugin-vinext-zephyr`         | [vinext.md](references/integrations/vinext.md)                 |
| webpack        | `zephyr-webpack-plugin`             | [webpack.md](references/integrations/webpack.md)               |
| Rspack         | `zephyr-rspack-plugin`              | [rspack.md](references/integrations/rspack.md)                 |
| Rsbuild        | `zephyr-rsbuild-plugin`             | [rsbuild.md](references/integrations/rsbuild.md)               |
| Modern.js      | `zephyr-modernjs-plugin`            | [modernjs.md](references/integrations/modernjs.md)             |
| Rspress        | `zephyr-rspress-plugin`             | [rspress.md](references/integrations/rspress.md)               |
| Rollup         | `rollup-plugin-zephyr`              | [rollup.md](references/integrations/rollup.md)                 |
| Rolldown       | `zephyr-rolldown-plugin`            | [rolldown.md](references/integrations/rolldown.md)             |
| Parcel         | `parcel-reporter-zephyr`            | [parcel.md](references/integrations/parcel.md)                 |
| Astro          | `zephyr-astro-integration`          | [astro.md](references/integrations/astro.md)                   |
| Nuxt           | `zephyr-nuxt-module`                | [nuxt.md](references/integrations/nuxt.md)                     |
| Metro          | `zephyr-metro-plugin`               | [metro.md](references/integrations/metro.md)                   |
| Re.Pack        | `zephyr-repack-plugin`              | [repack.md](references/integrations/repack.md)                 |

## Answer flow

1. Identify the user's stack and deployment goal.
2. Read `references/sdk-setup.md` to pick an SDK or run `with-zephyr`, then the stack's guide above to configure it.
3. Read `references/deployment-model.md` for versions, snapshots, tags, envs, and dashboard workflows.
4. Read `references/env-vars.md` if the task mentions env vars, runtime config, build once deploy everywhere, or `ZE_PUBLIC_*`.
5. Read `references/examples-resume.md` when the user wants concrete starter patterns.
6. Read `references/docs-map.md` when deeper docs links are useful.
7. Read `references/troubleshooting.md` when setup/build/auth/git issues appear.

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
