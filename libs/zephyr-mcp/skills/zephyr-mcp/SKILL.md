---
name: zephyr-mcp
description: Write and build agent tools for the organization's Zephyr MCP with
  zephyr-mcp; use when adding tools/<tool_name>.ts with defineTool, setting up
  the zephyr-mcp/rslib preset, fixing ZD07xx findings from a tools build, or
  deciding whether a skills repo needs a build at all.
metadata:
  library: zephyr-mcp
  library_version: '1.6.0' # x-release-please-version
  purpose: Build a repo's tools into a provider artifact that the Zephyr MCP runs in an isolate, and deploy it with ze-cli.
  domain: cli
  type: core
sources:
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-mcp/src/define.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-mcp/src/types.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-mcp/src/rules.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-mcp/src/rslib/index.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-mcp/src/checks/*.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-mcp/src/worker/handler.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/zephyr-mcp/README.md
  - ZephyrCloudIO/zephyr-packages:**/docs/mcp-provider-publication.md
---

# Build tools for the Zephyr MCP

## Decide whether the repo needs a build

A repo with only `skills/<skill-name>/SKILL.md` folders needs no package.json,
no build and nothing from zephyr-mcp: `npx zephyr-cli@latest deploy .` checks
and uploads it. Add zephyr-mcp only when the repo has tools:

```
<repo>/
├─ package.json                  # depends on zephyr-mcp, builds with rslib
├─ rslib.config.ts
├─ skills/<skill-name>/SKILL.md  # optional, shipped with the tools
└─ tools/<tool_name>.ts          # one tool per file; the file name is the tool name
```

```bash
pnpm add zephyr-mcp zod
pnpm add -D @rslib/core
```

## Write a tool

```ts
// tools/quote_price.ts
import { defineTool } from 'zephyr-mcp';
import * as z from 'zod';

export default defineTool({
  description: 'Price a basket with the checkout pricing rules.',
  inputSchema: z.object({ sku: z.string(), quantity: z.int().min(1) }),
  outputSchema: z.object({ total: z.number() }),
  annotations: { readOnlyHint: true },
  handler: ({ quantity }) => ({ total: quantity * 10 }),
});
```

- The default export is the tool. Omit `name`; if you set it, it must equal
  the file name (ZD0735).
- Set `readOnlyHint` or `destructiveHint` (ZD0731). `search`, `execute` and
  `connection_status` are reserved names (ZD0734).
- Schemas must convert to JSON Schema with an object root (ZD0737): zod 4,
  valibot and arktype work.
- Tools run in a Workers isolate: no `node:*` or `cloudflare:*` imports, no
  per-caller state in module globals, and honor `signal` for long calls.
- Files under `tools/` subfolders, files starting with `_`, `*.test.ts`,
  `*.spec.ts` and `*.d.ts` are shared code or tests, not tools.

## Build and deploy

```ts
// rslib.config.ts
import { defineMcpConfig } from 'zephyr-mcp/rslib';

export default defineMcpConfig();
```

`rslib build` bundles every tool into one self-contained `dist/tools/index.js`,
loads it in Node to read the schemas (top-level tool code runs in CI), writes
`catalog.json`, `mcp-provider.json` and the served skill files to `dist/`, and
fails on any check error. Deploy the output, not the repo root:

```bash
pnpm build
npx zephyr-cli@latest deploy dist
```

In CI, set `ZE_CI_TOKEN` from the secret store and commit the lockfile.

## Avoid misleading fixes

- Do not run `ze-cli deploy .` in a tools repo: it fails with ZD0732 until you
  build and deploy `dist`.
- Do not silence a ZD0733 secret finding by moving the value into a `?raw`
  import or a dependency: the preset scans the bundle, not just `tools/`.
- Do not add externals or code splitting to the Rslib config: the bundle must
  be one module with no imports, or the build fails.
- Do not pin `compatibilityDate` before `2025-11-17` or past the default
  without a reason: the Zephyr MCP skips every tool of a provider outside its
  supported range.

## Verify completion

`rslib build` exits 0 and `dist/` holds `mcp-provider.json`, `catalog.json`,
`tools/index.js` and any `skills/`. `npx zephyr-cli doctor dist` reports no
ZD07xx errors. A deploy prints the published version; the tools reach agents
once that version is released in Zephyr.
