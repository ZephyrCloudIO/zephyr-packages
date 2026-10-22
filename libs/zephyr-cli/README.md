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

The `zephyr-cli` Agent Skill teaches AI coding agents how to set up and debug this
package. It lives in the
[ZephyrCloudIO/skills](https://github.com/ZephyrCloudIO/skills)
repository, next to the shared `zephyr-core` and
`zephyr-module-federation` guides. Zephyr does not need it at runtime.

Add it to your project with the [`skills` CLI](https://github.com/vercel-labs/skills):

```sh
npx skills add ZephyrCloudIO/skills --skill zephyr-cli
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

# Print the result as one JSON line on stdout, with logs on stderr
ze-cli deploy ./dist --format json
```

With `--format json`, a successful deploy prints
`{"applicationUid":"…","versionUrl":"https://…","targetUrls":["https://…"]}`.
`versionUrl` is the immutable URL of this version and is `null` if Zephyr returned
none; `targetUrls` lists the tag and environment URLs that now serve it. Tools that
deploy on a user's behalf should read this line instead of parsing logs.

### Watch Command

Publish the initial output and then publish each settled output change without
rebuilding the TAP host. This command deliberately requires `--target tap-app`:

```bash
# The Zephyr control plane authorizes the development tag; the CLI never creates one locally.
ze-cli watch ./dist --target tap-app --metadata ./dist/zephyr-publication.json
```

### Doctor Command

Inspect a project or monorepo without installing dependencies, evaluating config
files, editing files, building, or deploying. By default it also makes no network
request and does not authenticate (see [Online checks](#online-checks) for `--online`):

```bash
ze-cli doctor [directory] --format text
ze-cli doctor [directory] --format json
```

The directory defaults to the current directory and must contain `package.json`.
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

JSON uses schema version `1.0.0` (`1.1.0` with `--online`). Consumers should branch on `status`,
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

#### Online checks

By default doctor makes no network request. Add `--online` to also check that Zephyr
works for this project:

```bash
ze-cli doctor [directory] --online [--timeout <milliseconds>] [--format json]
```

The checks send read-only requests, one at a time, and each has its own limit
(default `5000` ms, at most `60000`). A slow or silent server cannot hang doctor.
They do not log in, exchange tokens, or change stored state, and a rejected token is
never deleted.

| Check         | What it asks                                                            |
| ------------- | ----------------------------------------------------------------------- |
| `api`         | Does the API (`ZE_API`) answer?                                         |
| `gateway`     | Does the gateway (`ZE_API_GATE`) answer?                                |
| `token`       | Does the gateway accept your token (`ZE_SECRET_TOKEN` or stored login)? |
| `application` | Does Zephyr have a configuration for this application?                  |
| `edge`        | Does the edge URL in that configuration answer?                         |

A check is `passed`, `failed` or `skipped`. A check is skipped when an earlier check it
needs has failed; its `findingCode` points at the finding that explains why.
`ZE_CI_TOKEN` and `ZE_SERVER_TOKEN` are exchanged for an access token during a build.
Doctor does not exchange them, so it reports `ZD0708` (info) and does not check the
token. The application name comes from `package.json` and the git remote `origin`.
If a `zephyr.config` file exists, doctor does not run it and skips the application and
edge checks (`ZD0709`, info).

The report keeps the offline schema and adds an `online` object, plus `check`,
`target` (an origin, never a path or a token) and `nextAction` on online findings. Its
`schemaVersion` is `1.1.0`. A report made without `--online` is unchanged and keeps
`1.0.0`. `nextAction` has the same values as the MCP field: `none`,
`refresh_credentials`, `check_permissions`, `retry_later`, `correct_request`.

The exit codes above do not change. Online errors and warnings exit `1`. A missing
project (`2`) or a tool failure (`3`) still outranks them.

| Code     | Check            | Meaning                                                            |
| -------- | ---------------- | ------------------------------------------------------------------ |
| `ZD0701` | `api`            | API cannot be reached (network error or timeout)                   |
| `ZD0702` | `api`            | API answered with HTTP 5xx                                         |
| `ZD0703` | `gateway`        | Gateway cannot be reached (network error or timeout)               |
| `ZD0704` | `gateway`        | Gateway answered with HTTP 5xx                                     |
| `ZD0705` | `token`          | No token found                                                     |
| `ZD0706` | `token`          | Token rejected (HTTP 401)                                          |
| `ZD0707` | `token`          | Token not allowed (HTTP 403)                                       |
| `ZD0708` | `token`          | Token not checked (exchange token, or the gateway gave no verdict) |
| `ZD0709` | `application`    | Application name not found, so the application was not checked     |
| `ZD0710` | `application`    | No configuration for this application (HTTP 404)                   |
| `ZD0711` | `application`    | Token cannot read this application (HTTP 403)                      |
| `ZD0712` | `application`    | Configuration answer is not correct                                |
| `ZD0713` | `application`    | Configuration could not be loaded (network error, timeout, 5xx)    |
| `ZD0714` | `edge`           | Edge URL cannot be reached (network error or timeout)              |
| `ZD0715` | `edge`           | Edge URL answered with HTTP 5xx                                    |
| `ZD0716` | `api`, `gateway` | `ZE_API` or `ZE_API_GATE` is not a valid http or https URL         |

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

## Skip mode

Set `ZE_DISABLED=true` to build without Zephyr. `ze-cli run` runs your build command,
and `ze-cli deploy` and `ze-cli watch` do nothing. None of them contacts Zephyr, reads
a token, or needs git information. Each prints:

```text
The bundle is built. The bundle is not deployed. Zephyr is disabled (ZE_DISABLED).
```

Only the exact value `true` turns it on. It never turns on by itself, and it is not the
same as the fail-open behavior after an outage, where Zephyr is still contacted.
`ze-cli deploy --format json` prints `{"skipped":true,"reason":"ZE_DISABLED"}`. A failed
build command still fails: skip mode never hides a build error. Set it next to
`ZE_FAIL_BUILD`, which makes a Zephyr failure fail the build.

These integrations read it: `zephyr-webpack-plugin`, `zephyr-rspack-plugin`,
`zephyr-rsbuild-plugin` (and so `zephyr-modernjs-plugin`), `vite-plugin-zephyr`
(`withZephyr` and `withZephyrPartial`), and `ze-cli`. The plugins print the line once,
after the bundle is built without errors. Other integrations do not read it yet. With
skip mode on, `vite-plugin-zephyr` does not add the Zephyr runtime plugin to Module
Federation or rewrite `ZE_PUBLIC_*` reads, so remotes keep the URLs in your config. If
the wrapped build already runs a Zephyr plugin, both print the line.

## Options

- `--ssr` - Mark this snapshot as server-side rendered
- `--target, -t <target>` - Build target: `web`, `ios`, `android`, or `tap-app` (default: `web`)
- `--metadata <path>` - JSON Module Federation sidecar. Required with `--target tap-app`.
- `--debounce <milliseconds>` - Delay a `watch` publication until output changes settle (default: `250`)
- `--format <json|text>` - Doctor report format, or deploy result format (default: `text`)
- `--online` - Doctor only: also check the API, gateway, token, application configuration and edge URL
- `--timeout <milliseconds>` - Doctor `--online` only: limit for each check (default: `5000`)
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

1. **Extracts assets** from the specified directory
2. **Uploads assets** to Zephyr's edge network

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
- A `package.json` file (for application metadata)

## License

Apache-2.0
