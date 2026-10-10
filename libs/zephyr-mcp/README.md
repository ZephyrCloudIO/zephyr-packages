# zephyr-mcp

Ship agent skills and tools to the Zephyr MCP. Teams keep skills and tools in
one repo shape and deploy them with `ze-cli`. Every engineer's agent then gets
the released versions through the Zephyr MCP.

A skills-only repo needs nothing from this package: `npx zephyr-cli@latest
deploy .` checks it and uploads it. A repo with tools uses `defineTool` and the
Rslib preset to build them into a provider artifact. This package also holds
the formats, checks and isolate protocol that `ze-cli`, the Zephyr API and the
Zephyr MCP share. [Deploy from CI](#deploy-from-ci) has a workflow for each
repo shape.

## Installation

```bash
pnpm add zephyr-mcp zod
pnpm add -D @rslib/core
```

Any Standard Schema with JSON Schema support works for tool schemas: zod 4,
valibot or arktype.

## AI Agent Skills (Optional)

This package ships the `zephyr-mcp` Agent Skill for AI coding agents, together
with the shared `zephyr-core` and `zephyr-module-federation` guides. The
skills are versioned with the package, so your agent reads guidance that
matches the release you installed.

Zephyr does not need Intent at runtime. Coding agents only find these skills
after you opt in with
[TanStack Intent](https://tanstack.com/intent/latest/docs/getting-started/quick-start-consumers):

```sh
pnpm add -D @tanstack/intent
pnpm dlx @tanstack/intent@latest install
```

Allow `zephyr-mcp` when `install` asks. To check or load the skill yourself:

```sh
pnpm exec intent list
pnpm exec intent load 'zephyr-mcp#zephyr-mcp'
```

## Entry points

| Entry                 | Runs in  | Exports                                                                        |
| --------------------- | -------- | ------------------------------------------------------------------------------ |
| `zephyr-mcp`          | Anywhere | `defineTool` and the tool types                                                |
| `zephyr-mcp/rslib`    | Node     | `defineMcpConfig`, the Rslib preset for a tools repo                           |
| `zephyr-mcp/manifest` | Anywhere | `catalog.json`, `mcp-provider.json` and eval results: types, parsers, builders |
| `zephyr-mcp/worker`   | Anywhere | `createProviderWorker` and `callProviderWorker`, the isolate protocol          |
| `zephyr-mcp/checks`   | Node     | `checkRepo`, `checkCatalog` and `checkArtifact` with `ZD07xx` codes            |
| `zephyr-mcp/repo`     | Node     | `loadRepo`, the served skill files and tool files of a repo                    |
| `zephyr-mcp/raw`      | Types    | Types for `?raw` imports in tool files                                         |

"Anywhere" includes Workers: those entries never import `node:*`.

## Ship skills and tools

### Repo shape

```
<repo>/
├─ skills/<skill-name>/SKILL.md          # Agent Skills; name equals the folder name
│  ├─ references/** assets/** scripts/** # served next to SKILL.md
│  └─ evals/evals.json                   # skill-creator evals; never uploaded or served
└─ tools/<tool_name>.ts                  # one tool per file; the file name is the tool name
```

- Served skill files are `SKILL.md` plus regular files under `references/`,
  `assets/` and `scripts/`. Dot segments, `node_modules`, `evals` and `*.map`
  files (both in any case) and symlinks are never included. Other entries at
  the top of a skill folder are reported and left out.
- A skill has at most 512 files and 16 MiB in total, and no file over 5 MiB.
- Tool files are `tools/*.ts`, except `*.d.ts`, `*.test.ts`, `*.spec.ts` and
  names starting with `_`. Subfolders of `tools/` hold shared code.
- `search`, `execute` and `connection_status` are reserved tool names.
- A skills-only repo has no `package.json` and no build:
  `npx zephyr-cli@latest deploy .` checks it and uploads it.

```ts
// tools/quote_price.ts: defineTool's name is optional here
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

`loadRepo(root)` from `./repo` returns the served skill files as raw bytes and
the tool file paths, by exactly these rules.

### Build tools with the Rslib preset

```bash
pnpm add -D @rslib/core
```

```ts
// rslib.config.ts
import { defineMcpConfig } from 'zephyr-mcp/rslib';

export default defineMcpConfig();
```

`rslib build` then writes the provider artifact to `dist/`, ready for
`npx zephyr-cli@latest deploy dist`:

```
dist/
├─ mcp-provider.json
├─ catalog.json
├─ skills/<skill-name>/...    # the served skill files, byte for byte
└─ tools/index.js             # every tool, in one self-contained ES module
```

The preset bundles `tools/*.ts` for a web worker into `dist/tools/index.js`
and fails the build when that file has an `import`, an `export ... from`, an
`import()` or a `node:*` or `cloudflare:*` reference, or when the build emits anything else. It then loads
the bundle in Node to read each tool's schemas (your tools' top-level code
runs in CI), builds `catalog.json`, copies the skill files, writes
`mcp-provider.json`, and runs the repo and catalog checks. Any error fails the
build.

| Option              | Default                   | What it sets                             |
| ------------------- | ------------------------- | ---------------------------------------- |
| `name`              | `slug(package.json name)` | The provider name                        |
| `version`           | `package.json` version    | The provider version                     |
| `compatibilityDate` | `2026-07-01`              | The isolate's Workers compatibility date |

The Zephyr MCP loads a provider only when its `compatibilityDate` is between
`2025-11-17` and the MCP's own compatibility date, and otherwise skips all of
its tools. The build fails on a date before `2025-11-17` and warns on one
later than the default.

`slug` lowercases, drops an `@scope/`, turns other characters into `-` and
keeps 64 characters: `@acme/billing-tools` becomes `billing-tools`.

### Deploy from CI

A skills-only repo has no `package.json` and no build:

```yaml
# .github/workflows/zephyr.yml
name: Deploy skills
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      # Optional: run your skill evals and write eval-results.json
      # (format "zephyr-evals/v1"); Zephyr stores the results with the version.
      - name: Deploy
        env:
          ZE_CI_TOKEN: ${{ secrets.ZE_CI_TOKEN }}
        run: |
          if [ -f eval-results.json ]; then
            npx zephyr-cli@latest deploy . --eval-results eval-results.json
          else
            npx zephyr-cli@latest deploy .
          fi
```

A tools repo builds first and deploys `dist`. Commit `pnpm-lock.yaml`, since
the workflow installs with `--frozen-lockfile`:

```yaml
# .github/workflows/zephyr.yml
name: Deploy tools
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      # Bundles tools/*.ts, checks the repo and writes the artifact to dist/.
      - run: pnpm build
      - name: Deploy
        env:
          ZE_CI_TOKEN: ${{ secrets.ZE_CI_TOKEN }}
        run: npx zephyr-cli@latest deploy dist
```

Release the version in Zephyr and every engineer's agent gets the skills and
tools through the Zephyr MCP.

### catalog.json and mcp-provider.json

`mcp-provider.json` names the provider and points at its catalog. It is
strict: unknown keys are errors.

```json
{
  "manifestVersion": 1,
  "name": "billing-tools",
  "version": "1.0.0",
  "catalog": "catalog.json",
  "generator": { "name": "zephyr-mcp/rslib", "version": "1.6.0" }
}
```

`catalog.json` lists every skill (frontmatter and files with `mimeType`,
`size` and `sha256` over the raw bytes), every tool (draft 2020-12 JSON
Schemas with an object root) and, when there are tools, the one runtime
module with its digest and compatibility date. Unknown keys are kept, so
newer producers stay readable. `./manifest` exports the types, zod schemas
and helpers, all Worker-safe:

| Export                                                       | Does                                                                                      |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `parseProviderDescriptor(input)`                             | Parses `mcp-provider.json` (text, bytes or JSON)                                          |
| `parseCatalogManifest(input, { descriptor? })`               | Parses and validates `catalog.json`; throws `ManifestError` with every issue              |
| `parseEvalResults(input, { catalog? })`                      | Parses `zephyr-evals/v1` results, strict at every level, with the cross-field rules       |
| `buildCatalogManifest({ provider, skills, tools, runtime })` | Builds a sorted catalog from raw bytes                                                    |
| `toCatalogTool(tool, { name? })`                             | A tool's catalog entry; throws `RuleError` (`tool-schema-invalid`) for an unusable schema |
| `mimeTypeFor(path)`, `isTextMimeType(type)`                  | The normative MIME table                                                                  |
| `sha256Hex(bytes)`, `slug(name)`                             | Digests with Web Crypto, and names                                                        |

### Checks and codes

`./checks` reports findings as `{ rule, code, severity, path, message }`
(plus `skill` or `tool` when there is one), with project-relative paths and
never file contents. Secrets are shown as their first four characters and
`…`. Every file is scanned for secrets, as latin1 when it is not valid UTF-8.
ze-cli prints the same `ZD07xx` codes.

- `checkRepo(root)`: R mode, on a source repo. Only a repo with a `skills/`
  folder or tool files is checked; any other package gets no findings. A repo
  with tool files opts in with a dependency on `zephyr-mcp` or a
  `zephyr.config.*` that sets a literal `mcp: true`, read without running it
  as ze-cli doctor does.
- `checkCatalog(catalog, descriptor?)`: A mode, on a catalog.
- `checkArtifact(files)`: A mode, on a whole artifact by path, including the
  exact file set, sizes, digests and the runtime module rules.

`./checks` is a Node entry, because `checkRepo` reads the disk. In a Worker, validate with `parseProviderDescriptor` and
`parseCatalogManifest` from `./manifest`.

The runtime module rules read the source text. They catch honest mistakes
(an import the bundler left in, a `node:*` module) but are not a sandbox:
the host's isolate is the boundary.

| Code   | Rule                          | Severity | Mode | Finds                                                                                   |
| ------ | ----------------------------- | -------- | ---- | --------------------------------------------------------------------------------------- |
| ZD0701 | `repo-empty`                  | error    | R    | A `skills/` folder without a SKILL.md skill, and no tool files                          |
| ZD0702 | `skill-unknown-entry`         | warning  | R    | An entry outside SKILL.md, references/, assets/, scripts/, evals/, or a symlink         |
| ZD0710 | `skill-missing-file`          | error    | R    | A skill folder without SKILL.md                                                         |
| ZD0711 | `skill-frontmatter-invalid`   | error    | R A  | Frontmatter missing, not YAML, or not a mapping                                         |
| ZD0712 | `skill-name-invalid`          | error    | R A  | Name missing, invalid, `evals`, or not the folder name                                  |
| ZD0713 | `skill-description-invalid`   | error    | R A  | Description missing or over 1,024 characters                                            |
| ZD0714 | `skill-metadata-invalid`      | error    | R A  | A non-string metadata value, or compatibility over 500 characters                       |
| ZD0715 | `skill-owner-missing`         | error    | R A  | `metadata.owner` or `metadata.contact` missing                                          |
| ZD0716 | `skill-link-broken`           | error    | R A  | A relative link in the SKILL.md body that leaves the skill or is not a served file      |
| ZD0717 | `skill-too-long`              | warning  | R A  | A SKILL.md body over 500 lines                                                          |
| ZD0718 | `skill-secret`                | error    | R A  | A likely secret in a skill file                                                         |
| ZD0719 | `skill-file-too-large`        | error    | R A  | A file over 5 MiB, or more than 512 files or 16 MiB in one skill                        |
| ZD0720 | `evals-invalid`               | warning  | R    | `evals/evals.json` not in the skill-creator format                                      |
| ZD0721 | `evals-skill-mismatch`        | warning  | R    | `skill_name` differs from the skill                                                     |
| ZD0730 | `tool-name-invalid`           | error    | R A  | A tool name outside `^[A-Za-z0-9_-]{1,64}$`                                             |
| ZD0731 | `tool-hint-missing`           | error    | R A  | Neither `readOnlyHint` nor `destructiveHint`                                            |
| ZD0732 | `tools-build-missing`         | error    | R    | Tool files without a package.json, an opt-in, or `dist/mcp-provider.json`               |
| ZD0733 | `tool-secret`                 | error    | R A  | A likely secret in a tool source or `tools/index.js`                                    |
| ZD0734 | `tool-name-reserved`          | error    | R A  | `search`, `execute` or `connection_status`                                              |
| ZD0735 | `tool-name-mismatch`          | error    | R    | `defineTool`'s name differs from the file name                                          |
| ZD0736 | `tool-export-invalid`         | error    | R    | No default export, description or handler                                               |
| ZD0737 | `tool-schema-invalid`         | error    | R A  | A schema without a JSON Schema conversion, or without an object root                    |
| ZD0740 | `artifact-descriptor-invalid` | error    | A    | An invalid `mcp-provider.json`                                                          |
| ZD0741 | `artifact-catalog-invalid`    | error    | A    | An invalid catalog, provider mismatch, missing or extra file, digest or runtime problem |
| ZD0742 | `artifact-path-denied`        | error    | A    | An `evals` segment, `*.map`, dot segment or `.ts` source under `tools/`                 |
| ZD0743 | `catalog-name-clash`          | error    | R A  | A skill or tool name listed twice                                                       |

### Run tools in a Worker Loader isolate

`tools/index.js` default-exports `createProviderWorker(provider)` from
`./worker`: a Worker with one route. The host calls it with a fresh request
that carries nothing but the protocol:

```
POST https://provider.internal/call-tool
x-federated-mcp-protocol: 1
content-type: application/json

{ "name": "quote_price", "arguments": { "sku": "SKU-42", "quantity": 3 },
  "context": { "client": { "name": "claude-code" }, "caller": { "id": "user-1" }, "deadlineMs": 30000 } }
```

Every response carries `x-federated-mcp-protocol: 1`. A call answers 200 with
a `CallToolResult`, and invalid arguments, thrown errors and output that does
not match the `outputSchema` come back as `isError: true`. An unknown tool is
404, a missing or different protocol header 400, a malformed body 400, another
media type 415, another method 405 and any other path 404. `deadlineMs` and
the request's signal both abort the handler's `signal`. The provider stays
readable in Node through `Symbol.for('module-federation.mcp.provider')`.

On the host, load the module and call it with `callProviderWorker`. The host
sets the flags itself, whatever the catalog says, and refuses a catalog date
outside [`2025-11-17`, its own compatibility date]:

```ts
import { callProviderWorker } from 'zephyr-mcp/worker';

const { entry, compatibilityDate } = catalog.runtime;
if (compatibilityDate < '2025-11-17' || compatibilityDate > HOST_COMPATIBILITY_DATE) {
  throw new Error('provider not loaded: unsupported compatibility date');
}
const worker = env.LOADER.get(isolateId, () => ({
  mainModule: entry,
  modules: { [entry]: { js: moduleSource } },
  compatibilityDate,
  compatibilityFlags: ['enable_request_signal', 'global_fetch_strictly_public'],
  env: { PROVIDER: providerName, VERSION: versionId },
  globalOutbound: egressGateway,
})).getEntrypoint();

const result = await callProviderWorker(worker, {
  name: 'quote_price',
  arguments: { sku: 'SKU-42', quantity: 3 },
  context: { client: { name: 'claude-code' }, deadlineMs: 30_000 },
});
```

It throws a `ProviderCallError` for anything outside the protocol, with
`code: -32602` for an unknown tool, and for an answer over
`maxResponseBytes` (4 MiB by default). The provider's own error text is in
`providerError`, never in `message`, because the provider controls it. One isolate serves every caller of a
version, so tools must not keep per-caller state in module globals.

## Trust model

The Zephyr MCP never runs tools in its own process. Each provider version runs
in its own Worker Loader isolate with no bindings and an egress gateway, and
its catalog comes from the team's CI, so listing skills and tools never runs
customer code. The preset does run your tools' top-level code in CI, to read
their schemas.
