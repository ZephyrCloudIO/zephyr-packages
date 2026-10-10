# zephyr-cli

CLI tool for running build commands and automatically uploading assets to Zephyr.

## Installation

```bash
npm install zephyr-cli
# or
pnpm add zephyr-cli
# or
yarn add zephyr-cli
```

## AI Agent Skills (Optional)

This package ships the `zephyr-cli` Agent Skill for AI coding agents, together
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

Allow `zephyr-cli` when `install` asks. Intent saves that choice in the
`intent.skills` allowlist in your `package.json`. To check or load the skill
yourself:

```sh
pnpm exec intent list
pnpm exec intent load 'zephyr-cli#zephyr-cli'
```

## Usage

### Run Command (Default)

Run any build command and automatically upload the resulting assets:

```bash
ze-cli [options] <command>
```

#### Examples

```bash
# Run npm scripts
ze-cli pnpm build
ze-cli yarn build
ze-cli npm run build

# Run build tools directly
ze-cli tsc
ze-cli swc
ze-cli esbuild --bundle

# With environment variables
ze-cli NODE_ENV=production webpack

# Mark as SSR build
ze-cli --ssr pnpm build

# Build and publish a TAP package. CLI options for run appear before the build command.
ze-cli --target tap-app --metadata ./dist/zephyr-publication.json pnpm build
```

### Deploy Command

Upload pre-built assets from a directory:

```bash
ze-cli deploy <directory> [options]
```

#### Examples

```bash
# Upload from ./dist directory
ze-cli deploy ./dist

# Upload with specific target
ze-cli deploy ./dist --target ios

# Publish a TAP mini-app artifact
ze-cli deploy ./dist --target tap-app --metadata ./dist/zephyr-publication.json

# Mark as SSR
ze-cli deploy ./dist --ssr
```

### Watch Command

Publish the initial output and then publish each settled output change without
rebuilding the TAP host. This command deliberately requires `--target tap-app`:

```bash
# The Zephyr control plane authorizes the development tag; the CLI never creates one locally.
ze-cli watch ./dist --target tap-app --metadata ./dist/zephyr-publication.json
```

### Publish Skills and Tools to the Zephyr MCP

`ze-cli deploy` publishes an MCP provider privately to your organization's Zephyr
MCP (behind the `federated-mcp` organization flag) instead of uploading a public
web app. Two shapes are supported:

```bash
# A skills repo: skills/<skill-name>/SKILL.md, references/, assets/, scripts/
npx zephyr-cli deploy .

# A tools repo built with the zephyr-mcp/rslib preset
npx zephyr-cli deploy dist

# Store CI eval results with the version (never uploaded to the edge)
npx zephyr-cli deploy . --eval-results ./eval-results.json
```

`ze-cli` classifies the directory first, the same way for `deploy`, `run`,
`watch`, and `doctor`:

1. `mcp-provider.json` at the root: a built provider artifact.
2. No `package.json`: tool files (`tools/*.ts`) are an error (ZD0732); a
   `skills/` directory is a skills repo.
3. A `package.json` that opts in (a dependency on `zephyr-mcp`, or
   `mcp: true` in `zephyr.config.*`): tool files are an error until built
   (ZD0732, deploy `dist`); a `skills/` directory is a skills repo.
4. Anything else is a normal web deploy. A `skills/` directory there is
   published publicly, and `ze-cli` warns about it.

`deploy`, `run`, and `watch` load `zephyr.config.*` exactly as a build does, so any
config that resolves to `mcp: true` opts in; `doctor` never runs project code and
only recognizes a literal `mcp: true`.

Checks run before anything is uploaded or authenticated, and any error aborts
the deploy. For a skills repo `ze-cli` builds `mcp-provider.json` and
`catalog.json` in memory and uploads only `SKILL.md` and the files under
`references/`, `assets/`, and `scripts/`; `evals/`, dotfiles, `node_modules`,
`*.map`, and symlinks are never uploaded. For a built artifact it uploads exactly
the descriptor, the catalog, the files the catalog lists, and `tools/index.js`;
other files in `dist/` are skipped with a warning.

A skills repo has its own identity: the provider and application are named from
`appName` in `<dir>/zephyr.config.*` (which must be a valid skill name), else the
git repository name, else the directory name, with version `0.0.0`. A
`package.json` name is never used and parent directories are never searched. A
built artifact uses the nearest `package.json` above the deployed directory.

MCP deploys accept only `--target web` and reject `--metadata` and `--ssr`.
`run` and `watch` refuse MCP providers. Publication waits for the Zephyr API to
accept the version and reports rejected field paths as a local build error. See
[MCP provider publication](../../docs/mcp-provider-publication.md) for the full
contract.

### Doctor Command

Inspect a project or monorepo without installing dependencies, evaluating config
files, editing files, building, authenticating, or deploying:

```bash
ze-cli doctor [directory] --format text
ze-cli doctor [directory] --format json
```

The directory defaults to the current directory and must contain `package.json`,
unless it is an MCP provider (a skills repo or a built `mcp-provider.json`
artifact), which doctor classifies first and checks with the ZD07xx rules below.
Doctor statically checks:

- Supported bundler packages and config files.
- Zephyr and Module Federation plugin declaration, installation, config use, and
  plugin order.
- Declared, locked, and installed Zephyr, Module Federation, TypeScript,
  Rsbuild/Rspack, and other supported bundler versions.
- Rsbuild `output.assetPrefix`, explicit `source.entry`, exposes, object-form
  remotes, and `zephyr:dependencies` alias correspondence.
- Web watch scripts versus TAP-only `ze-cli watch --target tap-app --metadata`.
- `.mf/typesGenerate.log`, `node_modules/.federation` temporary artifacts,
  `@mf-types.zip`, and safe DTS diagnostic commands.
- MCP providers: skill folders, `SKILL.md` frontmatter and links, likely secrets,
  evals shape, tool file names, and built artifacts (ZD07xx). A skills repo
  without `package.json` runs only these checks; a tools repo runs both.

JSON uses schema version `1.1.0`. Schema `1.1.0` adds an optional `mcp` section
(`classification`, `skills`, `tools`, `descriptor`, `packageChecks`) and an
optional `rule` id on
ZD07xx findings. Consumers should branch on `status`,
`exitCode`, and finding `code`; they must not match human-readable messages.
Evidence paths are project-relative. Doctor never reads `.env` or emits config
source, authentication state, environment values, or file contents.
TypeScript report types, schema version, finding codes, and exit-code constants
are exported from `zephyr-cli/doctor/schema`.

#### Doctor exit codes

| Code | Meaning                                      |
| ---- | -------------------------------------------- |
| `0`  | Healthy; no warning or error findings        |
| `1`  | Valid project with warning or error findings |
| `2`  | Invalid project path or root `package.json`  |
| `3`  | Doctor could not complete the read-only scan |

ZD07xx warnings alone keep `status: "healthy"` and exit `0`; ZD07xx errors exit
`1`. Other warnings keep their exit code, including the package checks doctor runs
on a tools repo. A healthy skills repo without `package.json` exits `0`. For a
tools repo with a built `dist/mcp-provider.json`, doctor also runs the artifact
checks on `dist/` (tool hints, schemas, name clashes) with `dist/` evidence paths.

#### Stable finding codes

Every finding contains `code`, `severity`, `message`, structured `evidence`, and
`remediation`.

| Code     | Check                                                 |
| -------- | ----------------------------------------------------- |
| `ZD0001` | Project directory not found                           |
| `ZD0002` | Root `package.json` missing                           |
| `ZD0003` | Package manifest cannot be parsed                     |
| `ZD0004` | Read-only doctor scan failed                          |
| `ZD0101` | Supported bundler not detected                        |
| `ZD0102` | Rsbuild declared without an Rsbuild config            |
| `ZD0201` | Zephyr Rsbuild plugin not declared                    |
| `ZD0202` | Zephyr Rsbuild plugin not installed                   |
| `ZD0203` | `withZephyr()` missing from Rsbuild config            |
| `ZD0204` | Zephyr plugin appears before Module Federation        |
| `ZD0210` | Declared Module Federation plugin missing from config |
| `ZD0301` | Lockfile missing                                      |
| `ZD0302` | Relevant package not installed                        |
| `ZD0303` | Locked and installed package versions differ          |
| `ZD0304` | Lockfile version extraction unsupported               |
| `ZD0401` | Rsbuild `assetPrefix` missing                         |
| `ZD0402` | Rsbuild `assetPrefix` is not `"auto"`                 |
| `ZD0403` | Explicit Rsbuild `source.entry` missing               |
| `ZD0410` | Module Federation expose key invalid                  |
| `ZD0411` | Module Federation remotes are not object-form         |
| `ZD0412` | Remote aliases and `zephyr:dependencies` keys differ  |
| `ZD0501` | Web project uses TAP-only `ze-cli watch`              |
| `ZD0502` | TAP watch target missing                              |
| `ZD0503` | TAP watch metadata sidecar missing                    |
| `ZD0601` | Module Federation DTS diagnostic failure found        |

MCP provider codes. Mode R runs on a source repo (doctor and skills-repo deploy),
mode A on a built artifact. The rule id is shared with `zephyr-mcp`.

| Code     | Rule id                       | Severity | Mode | Check                                                                              |
| -------- | ----------------------------- | -------- | ---- | ---------------------------------------------------------------------------------- |
| `ZD0701` | `repo-empty`                  | error    | R    | No skill folder has `SKILL.md` and there are no tool files                         |
| `ZD0702` | `skill-unknown-entry`         | warning  | R    | Skill folder entry outside the served folders, or a symlink                        |
| `ZD0710` | `skill-missing-file`          | error    | R    | Skill folder without `SKILL.md`                                                    |
| `ZD0711` | `skill-frontmatter-invalid`   | error    | R A  | Frontmatter missing, not YAML, or not a mapping                                    |
| `ZD0712` | `skill-name-invalid`          | error    | R A  | Name invalid, `evals`, or not equal to the folder name                             |
| `ZD0713` | `skill-description-invalid`   | error    | R A  | Description missing or longer than 1,024 characters                                |
| `ZD0714` | `skill-metadata-invalid`      | error    | R A  | Non-string metadata, `license` or `allowed-tools`, or compatibility over 500 chars |
| `ZD0715` | `skill-owner-missing`         | error    | R A  | `metadata.owner` or `metadata.contact` missing                                     |
| `ZD0716` | `skill-link-broken`           | error    | R A  | Relative link leaves the skill folder or targets no served file                    |
| `ZD0717` | `skill-too-long`              | warning  | R A  | `SKILL.md` body longer than 500 lines                                              |
| `ZD0718` | `skill-secret`                | error    | R A  | Likely secret in a skill file (masked)                                             |
| `ZD0719` | `skill-file-too-large`        | error    | R A  | Skill file over 5 MiB, or a skill over 512 files or 16 MiB in total                |
| `ZD0720` | `evals-invalid`               | warning  | R    | `evals/evals.json` does not parse or has the wrong shape                           |
| `ZD0721` | `evals-skill-mismatch`        | warning  | R    | `skill_name` differs from the skill                                                |
| `ZD0730` | `tool-name-invalid`           | error    | R A  | Tool name does not match `^[A-Za-z0-9_-]{1,64}$`                                   |
| `ZD0731` | `tool-hint-missing`           | error    | R A  | Tool declares neither `readOnlyHint` nor `destructiveHint`                         |
| `ZD0732` | `tools-build-missing`         | error    | R    | Tool files without package.json, opt-in, or a built `dist/`                        |
| `ZD0733` | `tool-secret`                 | error    | R A  | Likely secret in a tool source or `tools/index.js` (masked)                        |
| `ZD0734` | `tool-name-reserved`          | error    | R A  | Tool named `search`, `execute`, or `connection_status`                             |
| `ZD0735` | `tool-name-mismatch`          | error    | R    | `defineTool` name differs from the file name (preset)                              |
| `ZD0736` | `tool-export-invalid`         | error    | R    | Missing default export, description, or handler (preset)                           |
| `ZD0737` | `tool-schema-invalid`         | error    | R A  | Schema root is not a JSON Schema `type: "object"`                                  |
| `ZD0740` | `artifact-descriptor-invalid` | error    | A    | `mcp-provider.json` invalid                                                        |
| `ZD0741` | `artifact-catalog-invalid`    | error    | A    | Catalog invalid, file mismatch, unsafe or unserved path, runtime imports, old date |
| `ZD0742` | `artifact-path-denied`        | error    | A    | `evals` segment, `*.map`, dot segment, or tools/ `.ts`                             |
| `ZD0743` | `catalog-name-clash`          | error    | R A  | Duplicate skill or tool name in one catalog                                        |

ZD0735 and ZD0736 need the tool module and are reported by the
`zephyr-mcp/rslib` preset, not by `ze-cli`.

## Options

- `--ssr` - Mark this snapshot as server-side rendered
- `--target, -t <target>` - Build target: `web`, `ios`, `android`, or `tap-app` (default: `web`)
- `--metadata <path>` - JSON Module Federation sidecar. Required with `--target tap-app`.
- `--debounce <milliseconds>` - Delay a `watch` publication until output changes settle (default: `250`)
- `--eval-results <path>` - `deploy` only, for MCP providers: CI eval results (`zephyr-evals/v1`) validated against the published skills and stored with the version. Never uploaded to the edge.
- `--format <json|text>` - Doctor output format (default: `text`)
- `--verbose, -v` - Enable verbose output
- `--help, -h` - Show help message

### TAP metadata sidecar

TAP SDK builds must pass `--metadata <path>` for `run`, `deploy`, and `watch`.
The file is JSON emitted by the SDK; it keeps each independently addressable
container in both the snapshot (`mfConfigs`) and build statistics (`federation`).
The CLI rejects a TAP upload if the sidecar is missing, malformed, empty, or if
an entry's `federation.remote` does not match its `mfConfigs.filename`.

```json
{
  "mfConfigs": [
    {
      "name": "desktop",
      "filename": "targets/desktop/remoteEntry.mjs",
      "library": { "type": "module" },
      "exposes": { "./ui": "./src/desktop.ts" }
    },
    {
      "name": "quickjs",
      "filename": "targets/quickjs/remoteEntry.mjs",
      "library": { "type": "module" },
      "exposes": { "./background": "./src/quickjs.ts" }
    }
  ],
  "federation": [
    {
      "name": "desktop",
      "remote": "targets/desktop/remoteEntry.mjs",
      "mf_manifest": "targets/desktop/mf-manifest.json",
      "library_type": "module"
    },
    {
      "name": "quickjs",
      "remote": "targets/quickjs/remoteEntry.mjs",
      "library_type": "module"
    }
  ]
}
```

Both arrays must be non-empty and represent the same containers. A single
container also gets the legacy `mfConfig` snapshot field; multi-container
sidecars intentionally do not choose an arbitrary first entry. The CLI accepts
an explicit `mfConfig` only for a TAP sidecar containing that same one container.
For `run`, place the options before the build command because the SDK creates the
sidecar during the build. For `watch`, the sidecar is reread for every snapshot.

## How It Works

### Run Command

1. **Parses the shell command** to detect the build tool and configuration files
2. **Detects configuration files** (e.g., `package.json`, `tsconfig.json`, etc.)
3. **Warns about dynamic configs** (e.g., JavaScript config files) and suggests alternatives
4. **Runs the command** with full stdio passthrough
5. **Infers the output directory** from the configuration
6. **Uploads assets** to Zephyr automatically

### Deploy Command

1. **Classifies the directory** (MCP provider artifact, skills repo, or web output)
2. **Checks MCP providers** with the ZD07xx rules and aborts on any error
3. **Extracts assets** from the specified directory, or for an MCP provider only
   the contract file set
4. **Uploads assets** to Zephyr's edge network

## Build Tool Detection

The CLI automatically detects configuration files for:

- **npm/yarn/pnpm**: Reads `package.json` for scripts
- **TypeScript (tsc)**: Reads `tsconfig.json` or the file specified with `-p` flag
- **Other tools**: Basic detection and suggestions

## Dynamic Configuration Warning

If your build tool uses a JavaScript configuration file (e.g., `webpack.config.js`, `rollup.config.js`), the CLI will warn you that the configuration is too dynamic to analyze and suggest:

- Using the Zephyr plugin for that bundler, such as `zephyr-webpack-plugin`,
  `rollup-plugin-zephyr`, or `vite-plugin-zephyr`
- Using `ze-cli deploy <dir>` after building

## Requirements

- Node.js 18+ or 20+
- Zephyr authentication: an interactive terminal opens a browser login; CI and
  other non-interactive shells need `ZE_CI_TOKEN`
- A git repository (for application identification)
- A `package.json` file (for application metadata), except for an MCP skills
  repo, which is identified by `zephyr.config` `appName`, its git repository, or
  its directory name

## License

Apache-2.0

## Optional Change Attribution

Enable with `with-zephyr . --attribution`, install Git AI through the linked
instructions, and optionally install project agent hooks. Then save and compare
private source records, including local changes at the same Git commit:

```bash
ze-cli attribution status
ze-cli attribution configure --storage local
ze-cli attribution configure --storage remote --patches include --lines omit
ze-cli attribution configure --storage local --local
ze-cli attribution capture --format json
ze-cli attribution compare <before-source-id> <after-source-id> --format json
```

`compare` also accepts local Zephyr snapshot IDs. Use `-C <project>` to select the
repository. These commands do not authenticate or deploy. Source text stays in
`zephyr-attribution/` under the worktree's private Git directory; comparisons need
both records on that machine. Missing provenance is unknown. Recorded identities
are self-reported, and removal attribution describes the removed line's original
contributor rather than who deleted it.

Opted-in run-mode builds capture source before the build command and again at
snapshot creation. Prebuilt deployments report publication-only observations.
Local storage (the default) emits no attribution in uploaded snapshots/build stats.
Remote storage posts evidence to the dedicated endpoint and emits an acknowledged
record reference; it requires authenticated policy/control-plane support. Free
remote requires patches/changed lines; paid/BYOC defaults omit them. `configure`
writes non-secret repo preferences; `--local` writes a private restriction that
cannot enable remote sharing. See the bundled `zephyr-core` Change
Attribution reference for source exclusions, limits, hook consent, and Git AI
compatibility, and its `attribution-storage.md` for server requirements.
