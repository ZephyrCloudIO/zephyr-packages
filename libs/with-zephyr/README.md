# with-zephyr

A codemod tool that automatically adds the `withZephyr` plugin to bundler configurations in your project.

## What is Zephyr?

[**Zephyr**](https://zephyr-cloud.io) is a developer-first SaaS platform focused on **Module Federation** for building, deploying, and managing micro-frontend applications. It provides:

- 🚀 **Edge-deployed micro-frontends** with global CDN distribution
- 🔧 **Universal bundler support** - works with Webpack, Vite, Rollup, and more
- 📊 **Real-time analytics** and deployment insights
- 🛡️ **Version management** with rollback capabilities
- 🌐 **Custom domains** and environment management

Learn more at [**zephyr-cloud.io**](https://zephyr-cloud.io) | [**Documentation**](https://docs.zephyr-cloud.io) | [**GitHub**](https://github.com/zephyr-cloud)

## Quick Start

Get your project Zephyr-ready in seconds:

```bash
# 1. Run the codemod to add Zephyr plugins to your bundler configs
npx with-zephyr --install
# or: pnpm dlx with-zephyr --install
# or: yarn dlx with-zephyr --install
# or: bunx with-zephyr --install

# 2. That's it! Your bundler is now configured for Zephyr deployments
# Visit https://app.zephyr-cloud.io to deploy your micro-frontends
```

## Supported Bundlers

This codemod supports **10+ bundlers** with their respective Zephyr plugins:

- **Webpack** ([`zephyr-webpack-plugin`](https://www.npmjs.com/package/zephyr-webpack-plugin))
- **Rspack** ([`zephyr-rspack-plugin`](https://www.npmjs.com/package/zephyr-rspack-plugin))
- **Vite** ([`vite-plugin-zephyr`](https://www.npmjs.com/package/vite-plugin-zephyr))
- **Rollup** ([`rollup-plugin-zephyr`](https://www.npmjs.com/package/rollup-plugin-zephyr))
- **Rolldown** ([`zephyr-rolldown-plugin`](https://www.npmjs.com/package/zephyr-rolldown-plugin))
- **Modern.js** ([`zephyr-modernjs-plugin`](https://www.npmjs.com/package/zephyr-modernjs-plugin))
- **RSPress** ([`zephyr-rspress-plugin`](https://www.npmjs.com/package/zephyr-rspress-plugin))
- **Parcel** ([`parcel-reporter-zephyr`](https://www.npmjs.com/package/parcel-reporter-zephyr))
- **RSBuild** ([`zephyr-rspack-plugin`](https://www.npmjs.com/package/zephyr-rspack-plugin))
- **Re.Pack** (React Native) ([`zephyr-repack-plugin`](https://www.npmjs.com/package/zephyr-repack-plugin))

## Installation

**No installation required!** Use directly with your package manager:

```bash
# npm
npx with-zephyr

# pnpm
pnpm dlx with-zephyr

# yarn
yarn dlx with-zephyr

# bun
bunx with-zephyr
```

> **💡 Tip:** Using `npx`/`dlx`/`bunx` ensures you always get the latest version without cluttering your global packages.

## Usage

### Basic Usage

Run the codemod in your project directory:

```bash
npx with-zephyr
```

This will:

1. Search for bundler configuration files in the current directory and subdirectories
2. Detect which bundler each config file is for
3. Add the appropriate `withZephyr` plugin configuration
4. Add the necessary import/require statements

### Command Line Options

```bash
# Show what would be changed without modifying files
npx with-zephyr --dry-run

# Automatically install missing plugin packages
npx with-zephyr --install

# Specify a different directory
npx with-zephyr ./my-project

# Only process specific bundlers
npx with-zephyr --bundlers webpack vite

# Combine options
npx with-zephyr ./src --dry-run --bundlers rollup --install

# Use with other package managers
pnpm dlx with-zephyr --install
yarn dlx with-zephyr --dry-run
bunx with-zephyr --bundlers vite rollup
```

### Options

- `[directory]` - Directory to search for config files (default: current directory)
- `-d, --dry-run` - Show what would be changed without modifying files
- `-b, --bundlers <bundlers...>` - Only process specific bundlers
- `-i, --install` - Automatically install missing plugin packages

## Examples

### Before and After

#### Webpack Configuration

**Before:**

```javascript
const { composePlugins, withNx, withReact } = require('@nx/webpack');

module.exports = composePlugins(withNx(), withReact(), (config) => {
  return config;
});
```

**After:**

```javascript
const { withZephyr } = require('zephyr-webpack-plugin');
const { composePlugins, withNx, withReact } = require('@nx/webpack');

module.exports = composePlugins(
  withNx(),
  withReact(),
  withZephyr(),
  (config) => {
    return config;
  }
);
```

#### Vite Configuration

**Before:**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
});
```

**After:**

```typescript
import { withZephyr } from 'vite-plugin-zephyr';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react(), withZephyr()],
});
```

#### Rollup Configuration

**Before:**

```javascript
module.exports = (config) => {
  return config;
};
```

**After:**

```javascript
const { withZephyr } = require('rollup-plugin-zephyr');

module.exports = (config) => {
  config.plugins.push(withZephyr());
  return config;
};
```

## Package Management

The codemod can automatically install missing Zephyr plugin packages using the `--install` flag.

### Package Manager Detection

The tool automatically detects your package manager by checking for:

1. **Lock files** (in order of priority):

   - `pnpm-lock.yaml` → pnpm
   - `yarn.lock` → yarn
   - `package-lock.json` → npm
   - `bun.lockb` → bun

2. **package.json `packageManager` field**
3. **Monorepo indicators** (`pnpm-workspace.yaml`, `lerna.json`)
4. **Environment variables** (`npm_config_user_agent`)

### Supported Package Managers

- **npm**: `npm install --save-dev <package>`
- **yarn**: `yarn add --dev <package>`
- **pnpm**: `pnpm add --save-dev <package>`
- **bun**: `bun add --dev <package>`

### Usage with Package Installation

```bash
# Install packages and update configs in one command
npx with-zephyr --install

# Preview what packages would be installed
npx with-zephyr --dry-run --install

# The tool will show you which packages need to be installed if you don't use --install
npx with-zephyr
# Output: 💡 Tip: Use --install to automatically install missing packages:
#           vite-plugin-zephyr
#           zephyr-webpack-plugin
```

## Configuration File Detection

The codemod automatically detects and processes these configuration files:

- `webpack.config.js/ts/mjs`
- `rspack.config.js/ts/mjs`
- `vite.config.js/ts/mjs`
- `rollup.config.js/ts/mjs`
- `rolldown.config.js/ts/mjs`
- `modern.config.js/ts/mjs`
- `rspress.config.js/ts/mjs`
- `.parcelrc/.parcelrc.json`

## Integration Patterns

The codemod recognizes and handles various configuration patterns:

### Webpack/Rspack

- `composePlugins()` calls (Nx style)
- `plugins: []` arrays
- Direct `module.exports` assignments

### Vite/Rolldown

- `defineConfig()` calls
- `plugins: []` arrays

### Rollup

- Function-based configs with `config.plugins.push()`
- `plugins: []` arrays

### Modern.js/RSPress

- `defineConfig()` calls with `plugins: []` arrays

### Parcel

- JSON configuration with `reporters` array

## Safety Features

- **Dry run mode**: Preview changes before applying them
- **Duplicate detection**: Skips files that already have `withZephyr` configured
- **Error handling**: Continues processing other files if one fails
- **Backup recommendation**: Always commit your changes before running codemods

## Troubleshooting

### Common Issues

1. **"Could not parse file"** - The configuration file has syntax errors or uses unsupported patterns
2. **"No suitable pattern found"** - The codemod doesn't recognize the configuration structure
3. **"Already has withZephyr"** - The plugin is already configured (this is expected behavior)

### Manual Configuration

If the codemod doesn't work for your specific configuration, you can manually add the withZephyr plugin:

1. Install the appropriate plugin package
2. Import/require the `withZephyr` function
3. Add it to your bundler's plugin configuration

Refer to the individual plugin documentation for specific setup instructions.

## Development

### Building

The codemod is written in TypeScript and bundled with tsup:

```bash
# Install dependencies
pnpm install

# Build the project
pnpm run build

# Development mode with watch
pnpm run dev

# Type checking
pnpm run typecheck
```

### Project Structure

```
src/
├── index.ts           # Main CLI entry point
├── types.ts           # TypeScript type definitions
├── bundler-configs.ts # Bundler configuration definitions
├── transformers.ts    # AST transformation functions
└── package-manager.ts # Package management utilities
```

## Contributing

Found a configuration pattern that isn't supported? Please open an issue or submit a pull request!
