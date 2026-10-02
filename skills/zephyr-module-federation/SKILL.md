---
name: zephyr-module-federation
description: Use when the user asks about zephyr:dependencies, hosts/remotes, Module Federation build order, remote resolution, cross-bundler remotes, or monorepo MF on Zephyr.
license: Apache-2.0
metadata:
  author: Zephyr Cloud IO
  purpose: Use when the user asks about zephyr:dependencies, hosts/remotes, Module Federation build order, remote resolution, cross-bundler remotes, or monorepo MF on Zephyr.
  domain: federation
  type: core
sources:
  - ZephyrCloudIO/zephyr-packages:**/skills/zephyr-module-federation/references/*.md
  - ZephyrCloudIO/zephyr-packages:**/scripts/sync-package-skills.mjs
---

# Zephyr Module Federation

Use this skill for Zephyr's Module Federation workflow: host/remote setup, `zephyr:dependencies`, resolution behavior, build order, and cross-bundler examples.

Module Federation is the pattern where a host app loads code from separately built remote apps at runtime.

Zephyr does not replace normal Module Federation config; it adds deploy-time dependency resolution and routing on top of the host/remote setup.

Use this skill when the user needs help wiring, resolving, or deploying hosts/remotes. Use `zephyr-core` when the question is mostly about general Zephyr setup, version URLs, tags/environments, or public env vars.

## What to cover

- Explain both layers: bundler MF config and Zephyr dependency mapping.
- Prefer concrete examples over abstract theory.
- Keep the answer grounded in the user's stack: Webpack, Rspack, Vite, Rsbuild, Turbo, Nx, or mixed-bundler.
- If the question is mostly about general Zephyr setup, version URLs, tags/envs, or public env vars, also read `../zephyr-core/SKILL.md`.
- Localhost remote URLs in examples are for local development only; deployed answers should steer toward Zephyr resolution instead of hardcoded production URLs.

## Core mental model

- Module Federation defines host/remote wiring in bundler config.
- Zephyr adds deploy-time dependency resolution through `zephyr:dependencies`.
- `workspace:*` is the most important Zephyr-specific dev workflow for coordinated branch/user/CI resolution.
- Remotes usually need to be built before hosts.
- Names must stay consistent across `package.json`, MF config, and dependency declarations.

## Answer flow

1. Read `references/setup-patterns.md` for host/remote config shapes.
2. Read `references/remote-resolution.md` for `zephyr:dependencies`, selectors, and `workspace:*`.
3. Read `references/examples.md` for concrete file paths and snippets.
4. Read `references/gotchas.md` for build order, naming, and mixed-bundler edge cases.
5. Link deeper docs from `references/docs-map.md`.

## Source priorities

- Public docs source: `https://docs.zephyr-cloud.io`
- Examples source: `https://github.com/ZephyrCloudIO/zephyr-examples`
- Docs site: `https://docs.zephyr-cloud.io`
- Raw docs path pattern: `https://docs.zephyr-cloud.io/<path>.md`
- Docs index: `https://docs.zephyr-cloud.io/llms.txt`

## Guardrails

- Do not treat `zephyr:dependencies` as a replacement for MF config; it complements it.
- Do not recommend hardcoded production remote URLs when Zephyr resolution should be used.
- Do not ignore build order for remotes and hosts.
- Call out naming mismatches early; they are a common failure source.
