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

## Options

- `--ssr` - Mark this snapshot as server-side rendered
- `--target, -t <target>` - Build target: `web`, `ios`, `android`, or `tap-app` (default: `web`)
- `--metadata <path>` - JSON Module Federation sidecar. Required with `--target tap-app`.
- `--debounce <milliseconds>` - Delay a `watch` publication until output changes settle (default: `250`)
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

- Using one of the Zephyr bundler plugins from `@libs/`
- Using `ze-cli deploy <dir>` after building

## Requirements

- Node.js 18+ or 20+
- A valid Zephyr authentication token (run `zephyr login` if needed)
- A git repository (for application identification)
- A `package.json` file (for application metadata)

## License

Apache-2.0
