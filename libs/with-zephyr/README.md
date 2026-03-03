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
curl -fsSL https://with.zephyr-cloud.io | node

# Alternative methods:
npx with-zephyr
pnpm dlx with-zephyr
yarn dlx with-zephyr
bunx with-zephyr

# 2. That's it! Your bundler is now configured for Zephyr deployments
# Visit https://app.zephyr-cloud.io to deploy your micro-frontends
```

## Supported Bundlers

This codemod supports **12+ bundlers** with their respective Zephyr plugins:

- **Webpack** ([`zephyr-webpack-plugin`](https://www.npmjs.com/package/zephyr-webpack-plugin))
- **Rspack** ([`zephyr-rspack-plugin`](https://www.npmjs.com/package/zephyr-rspack-plugin))
- **Vite** ([`vite-plugin-zephyr`](https://www.npmjs.com/package/vite-plugin-zephyr))
- **Rollup** ([`rollup-plugin-zephyr`](https://www.npmjs.com/package/rollup-plugin-zephyr))
- **Rolldown** ([`zephyr-rolldown-plugin`](https://www.npmjs.com/package/zephyr-rolldown-plugin))
- **Astro** ([`zephyr-astro-integration`](https://www.npmjs.com/package/zephyr-astro-integration))
- **Modern.js** ([`zephyr-modernjs-plugin`](https://www.npmjs.com/package/zephyr-modernjs-plugin))
- **RSPress** ([`zephyr-rspress-plugin`](https://www.npmjs.com/package/zephyr-rspress-plugin))
- **Parcel** ([`parcel-reporter-zephyr`](https://www.npmjs.com/package/parcel-reporter-zephyr))
- **RSBuild** ([`zephyr-rsbuild-plugin`](https://www.npmjs.com/package/zephyr-rsbuild-plugin))
- **RSLib** ([`zephyr-rsbuild-plugin`](https://www.npmjs.com/package/zephyr-rsbuild-plugin))
- **Re.Pack** (React Native) ([`zephyr-repack-plugin`](https://www.npmjs.com/package/zephyr-repack-plugin))

## Installation

**No installation required!** Use directly with one command:

```bash
# Recommended: Use the hosted version
curl -fsSL https://with.zephyr-cloud.io | node

# Alternative: Use with your package manager
npx with-zephyr       # npm
pnpm dlx with-zephyr  # pnpm
yarn dlx with-zephyr  # yarn
bunx with-zephyr      # bun
```

> **💡 Tip:** Using `npx`/`dlx`/`bunx` ensures you always get the latest version without cluttering your global packages.

## Usage

### Basic Usage

Run the codemod in your project directory:

```bash
# Recommended: Use the hosted version
curl -fsSL https://with.zephyr-cloud.io | node

# Alternative: Use with package managers
npx with-zephyr
```

This will:

1. Search for bundler configuration files in the current directory and subdirectories
2. Detect which bundler each config file is for
3. Add the appropriate `withZephyr` plugin configuration
4. Add the necessary import/require statements

For **Next.js** apps (detected via `next` in `package.json`), when no `vite.config.ts`
exists it will also scaffold a Vinext setup:

1. Create `vite.config.ts` with `vinext`, `@cloudflare/vite-plugin`, and `withZephyr`
2. Create `wrangler.jsonc` for `vinext/server/app-router-entry`
3. Replace `scripts.dev/build/start` with `vinext dev/build/start`
4. Set `package.json` `type` to `module` for ESM Vite/Vinext config loading
5. Ensure required Vinext deps are installed (`vinext`, `@vitejs/plugin-rsc`, etc.)

### Command Line Options

```bash
# Show what would be changed without modifying files
npx with-zephyr --dry-run

# Specify a different directory
npx with-zephyr ./my-project

# Only process specific bundlers
npx with-zephyr --bundlers webpack vite

# Combine options
npx with-zephyr ./src --dry-run --bundlers rollup

# Use with other package managers
pnpm dlx with-zephyr
yarn dlx with-zephyr --dry-run
bunx with-zephyr --bundlers vite rollup
```

### Options

- `[directory]` - Directory to search for config files (default: current directory)
- `-d, --dry-run` - Show what would be changed without modifying files
- `-b, --bundlers <bundlers...>` - Only process specific bundlers

> The codemod automatically installs missing Zephyr plugins using your detected package manager (npm/yarn/pnpm/bun). In `--dry-run` it will only list what would be installed.

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

module.exports = composePlugins(withNx(), withReact(), withZephyr(), (config) => {
  return config;
});
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

The codemod automatically installs missing Zephyr plugin packages when not running in `--dry-run` mode.

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

### Package Installation Behavior

- `npx with-zephyr` will install any required Zephyr plugins that are missing.
- `npx with-zephyr --dry-run` will list the packages it would install without making changes.

## Configuration File Detection

The codemod automatically detects and processes these configuration files:

- `webpack.config.js/ts/mjs`
- `rspack.config.js/ts/mjs`
- `vite.config.js/ts/mjs`
- `rollup.config.js/ts/mjs`
- `rolldown.config.js/ts/mjs`
- `astro.config.js/ts/mjs/mts`
- `modern.config.js/ts/mjs`
- `rspress.config.js/ts/mjs`
- `rsbuild.config.js/ts/mjs`
- `rslib.config.js/ts/mjs`
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

The codemod is written in TypeScript and built with Rspack/RSLib:

```bash
# Install dependencies
pnpm install

# Build the project
pnpm run build

# Development mode with watch
pnpm run dev

# Type checking
pnpm run typecheck

# Run the locally built CLI (no publish needed)
pnpm nx build with-zephyr
node ./libs/with-zephyr/dist/index.js --bundlers rspack /path/to/project
node ./libs/with-zephyr/dist/index.js --bundlers repack /path/to/react-native-project
```

### Project Structure

```
src/
├── bundlers/          # Per-bundler configs + registry
├── transformers/      # AST transforms (imports, plugin arrays, wrappers, etc.)
├── package-manager.ts # Package management utilities
├── index.ts           # CLI entry point and orchestration
└── types.ts           # Shared types
```

## Contributing

Found a configuration pattern that isn't supported? Please open an issue or submit a pull request!
