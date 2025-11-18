# zephyr-runner-cli

CLI tool for running build commands and automatically uploading assets to Zephyr.

## Installation

```bash
npm install zephyr-runner-cli
# or
pnpm add zephyr-runner-cli
# or
yarn add zephyr-runner-cli
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

# Mark as SSR
ze-cli deploy ./dist --ssr
```

## Options

- `--ssr` - Mark this snapshot as server-side rendered
- `--target, -t <target>` - Build target: `web`, `ios`, or `android` (default: `web`)
- `--verbose, -v` - Enable verbose output
- `--help, -h` - Show help message

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
