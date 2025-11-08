# zephyr-cli

Standalone CLI tool for uploading assets to Zephyr without requiring bundler-specific plugins.

## Installation

```bash
npm install zephyr-cli
# or
pnpm add zephyr-cli
# or
yarn add zephyr-cli
```

## Usage

```bash
zephyr <directory> [options]
```

### Arguments

- `<directory>` - Directory containing built assets (default: `./dist`)

### Options

- `--target, -t <target>` - Build target: `web`, `ios`, or `android` (default: `web`)
- `--verbose, -v` - Enable verbose output
- `--help, -h` - Show help message

### Examples

```bash
# Upload assets from ./dist directory
zephyr ./dist

# Upload assets from a custom directory
zephyr ./build

# Upload with specific target
zephyr ./dist --target ios

# Upload with verbose output
zephyr ./dist --verbose
```

## How It Works

The CLI tool:

1. **Auto-detects application information** from your project:

   - Application properties (org, project, name, version) from `package.json` and git
   - Git information from your repository
   - NPM dependencies from `package.json`
   - Application configuration from Zephyr API

2. **Extracts assets** from the specified directory by recursively walking through all files

3. **Uploads assets** to Zephyr's edge network

4. **Tracks the build** with build statistics and metadata

## No Configuration Required

Unlike bundler plugins, this CLI tool requires **no configuration file**. It automatically detects everything it needs from:

- Your `package.json` file
- Your git repository
- Your authentication token (from Zephyr CLI login)

This makes it perfect for:

- Post-build scripts
- CI/CD pipelines
- Custom build processes
- Any scenario where you want to upload assets without bundler integration

## Differences from Bundler Plugins

| Feature       | Bundler Plugins         | zephyr-cli          |
| ------------- | ----------------------- | ------------------- |
| Integration   | During build process    | Post-build          |
| Configuration | Auto-detected           | Auto-detected       |
| Use Case      | Integrated with bundler | Standalone upload   |
| Dependencies  | Bundler-specific        | None (just Node.js) |

## Requirements

- Node.js 18+ or 20+
- A valid Zephyr authentication token (run `zephyr login` if needed)
- A git repository (for application identification)
- A `package.json` file (for application metadata)

## Examples

### Basic Usage

```bash
# Build your application
npm run build

# Upload the built assets
zephyr ./dist
```

### With Custom Directory

```bash
# If your build outputs to a different directory
zephyr ./build
```

### In CI/CD

```bash
# In your CI/CD pipeline
npm run build
npx zephyr-cli ./dist
```

### With React Native

```bash
# For iOS builds
zephyr ./build/ios --target ios

# For Android builds
zephyr ./build/android --target android
```

## Error Handling

The CLI will exit with a non-zero code if:

- The directory doesn't exist
- No assets are found in the directory
- Authentication fails
- Upload fails

Check the error messages for details on what went wrong.

## License

Apache-2.0
