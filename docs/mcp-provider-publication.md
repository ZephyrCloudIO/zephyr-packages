---
summary: How zephyr-agent and ze-cli publish skills and tools as a private MCP provider.
read_when:
  - Changing MCP provider detection, validation, or upload in zephyr-agent.
  - Changing ze-cli MCP deploy mode, the classifier, --eval-results, or ZD07xx checks.
  - Changing the SnapshotMcp, ZephyrBuildStatsMcp, or EvalResults contract types.
---

# MCP provider publication

An uploaded output whose root contains `mcp-provider.json` is an MCP provider. Its
skills and tools are served to the organization's agents through the Zephyr MCP and
are never public. This is M1 of Zephyr MCP for teams; the same contract is
implemented by [`zephyr-mcp`](../libs/zephyr-mcp/README.md) (repo shape, Rslib
preset, isolate protocol), the Zephyr edge
(upload binding and private snapshots), the Zephyr API (storage, release, and
resolve), and the Zephyr MCP (serving).

## Repo shapes

```
<repo>/
├─ skills/<skill-name>/SKILL.md          # Agent Skills spec
│  ├─ references/** assets/** scripts/** # served
│  └─ evals/evals.json                   # never uploaded or served
└─ tools/<tool_name>.ts                  # one tool per file; needs the Rslib preset
```

A skills-only repo has no `package.json` and no build: `npx zephyr-cli deploy .`
builds the artifact in memory. A repo with tools depends on `zephyr-mcp`,
builds with its Rslib preset into `dist/`, and runs `npx zephyr-cli deploy dist`.

`ze-cli` classifies `<dir>` the same way for `deploy`, `run`, `watch`, and `doctor`:

1. `<dir>/mcp-provider.json` exists: provider artifact.
2. No `<dir>/package.json`: tool files are ZD0732 (evidence `tools`); a `skills/`
   directory is a skills repo.
3. `<dir>/package.json` opts in (any dependency field names `zephyr-mcp`,
   or `<dir>/zephyr.config.*` sets `mcp: true`): tool files are ZD0732 (evidence
   `dist/mcp-provider.json`; deploy the built `dist/`); a `skills/` directory is a
   skills repo.
4. Otherwise the unchanged web path, with a warning when `skills/` would be published
   publicly.

`deploy`, `run`, and `watch` load `<dir>/zephyr.config.*` with the same loader the
agent uses, so any config that resolves to `mcp: true` (a spread, a variable) opts
in, and a config that fails to load stops the command instead of falling back to a
public web upload. Doctor never executes `zephyr.config.*`; it only recognizes a
literal `mcp: true` property. `run` and `watch` refuse every MCP class, and `deploy`, `run`, and `watch` all print the
class 4 warning about a public `skills/` folder.

A skills-repo deploy validates the in-memory artifact (with a placeholder provider
name) before `ZephyrEngine.create`, then rebuilds it with the resolved name, so every
check runs before authentication. `doctor` runs the same artifact checks on a skills
repo, so a catalog over its size limit fails doctor as well as deploy.

## Artifact

The uploaded set is exactly `mcp-provider.json`, `catalog.json`, every catalog file at
`${skill.path}/${file.path}`, and `tools/index.js` when tools exist. zephyr-agent
rejects any `evals` segment, `*.map`, dot segments, and TypeScript under `tools/`
(ZD0742), and any other path, including a backslash, an empty segment, and skill
files outside `SKILL.md`, `references/`, `assets/`, and `scripts/` or under a
`node_modules` segment (ZD0741). A catalog-listed file that is missing is reported
once (ZD0741). `ze-cli doctor` hands catalog-listed denied paths to zephyr-agent, so
it reports the same ZD0742 findings as a deploy.
`tools/index.js` must be one self-contained UTF-8 module: a static import,
`export ... from`, `import()`, or a `node:` or `cloudflare:` specifier is ZD0741, in
zephyr-agent, `ze-cli deploy`, and `ze-cli doctor`. Catalog frontmatter problems use
the skill codes (ZD0712 name, ZD0713 description, ZD0714 metadata, compatibility,
license, and allowed-tools types; the source-repo rule uses ZD0714 for non-string
license and allowed-tools too). zephyr-agent requires every served `SKILL.md` to parse
(ZD0711) to the catalog's frontmatter, compared as key-sorted JSON (ZD0741 at
`skills/<name>/SKILL.md`), so bundler-plugin uploads get the same check as ze-cli. A
`runtime.compatibilityDate` earlier than `2025-11-17` is ZD0741. Each skill holds at most 512 files and 16 MiB
in total, with at most 5 MiB per file (ZD0719, SEP-2640); ze-cli checks the same limits
on the source repo. Sizes and sha256 values are checked over the raw bytes, file MIME
types must come from the normative table, tool schemas must have a root
`type: "object"`, and `search`, `execute`, and `connection_status` are reserved tool
names. The agent never generates `zephyr-manifest.json` for an MCP provider.

For a skills repo, ze-cli writes descriptor generator `{ name: "zephyr-cli" }`,
provider `{ name }`, skills and files sorted in UTF-16 code-unit order, and
`tools: []`.

## Identity

A skills repo uses the engine option `identity: { fromGitProject: true, isolated:
true }`. The agent reads `zephyr.config.*` only from `<dir>`, never walks up, never
reads `package.json`, and names the application `appName` (which must already be a
valid skill name), else `slug(git project)`, else `slug(basename(<dir>))`, with
version `0.0.0`. The git project is the repository name from `remote.origin.url`; a
zephyr.config `project` changes the Zephyr project, not the provider name. A provider artifact uses the nearest `package.json` walking up from
the deployed directory.

## Snapshot and build stats

Before any upload the agent requires `MCP_PRIVATE_SNAPSHOTS: true` in the
application configuration (only the default Zephyr Cloudflare edge without extra
environment edges qualifies) and a `baseHref` of empty or `/`. It then sets:

- `snapshot.mcp`: `{ manifestVersion: 1, name, descriptor: "mcp-provider.json",
catalog, catalogSha256, entry? }`, names and paths only. The edge hides every
  snapshot with a non-null `mcp` from anonymous reads.
- `buildStats.mcp`: `{ manifestVersion: 1, descriptor, catalog, catalogSha256,
evalResults? }`, with `remote: ''`, no `mf_manifest`, and `waitForCompletion:
true`. The build-stats request uses a 120 second deadline, does not retry 4xx, and
  maps a 4xx (403 included) to `ERR_DEPLOY_LOCAL_BUILD` listing only the API's issue
  paths. A 401 stays an authentication error so rejected credentials are cleared.

The hash-list request (`GET /__get_application_hash_list__`) sends the same
`can_write_jwt` header as uploads; a failed list still means "upload everything".

## Eval results

`ze-cli deploy <dir> --eval-results <file>` reads `zephyr-evals/v1` JSON, validates it
before `ZephyrEngine.create` (at most 1,000 results, totals match, every skill exists
in the catalog, unique `(skill, evalId)`, `runs >= 1`, `0 <= passRate <= 1`, a
canonical `agent` key, an `evalId` of 1 to 256 characters, a finite `durationMs >= 0`,
and a `generatedAt` that is a real ISO 8601 date-time). Like the API, the format is
strict: an unknown key at the root, in a result, or in `summary` is rejected with its
path (for example `ciRun` or `results[0].notes`). It passes the results to
`upload_assets` as
`mcpEvalResults`. The results travel only in build stats. Passing them for an output
without a root descriptor is an error.

## Checks

`ze-cli doctor` and MCP deploys report ZD07xx findings, each with a shared rule id
(see the zephyr-cli README). Doctor schema `1.1.0` adds the optional `mcp` report
section. ZD07xx warnings alone exit `0`; other doctor warnings keep their exit code.
For a tools repo with a built `dist/`, doctor also runs the artifact checks on it.
Deploys print findings to stderr
and abort on any error before authenticating or uploading.
