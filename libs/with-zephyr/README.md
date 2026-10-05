# with-zephyr

A codemod tool that automatically adds Zephyr integration to supported project configurations.

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

This codemod supports **15+ bundlers/framework configs** with their respective Zephyr integrations:

- **Webpack** ([`zephyr-webpack-plugin`](https://www.npmjs.com/package/zephyr-webpack-plugin))
- **Rspack** ([`zephyr-rspack-plugin`](https://www.npmjs.com/package/zephyr-rspack-plugin))
- **Vite** ([`vite-plugin-zephyr`](https://www.npmjs.com/package/vite-plugin-zephyr))
- **Slidev** (scaffolded to Vite using [`vite-plugin-zephyr`](https://www.npmjs.com/package/vite-plugin-zephyr))
- **Rollup** ([`rollup-plugin-zephyr`](https://www.npmjs.com/package/rollup-plugin-zephyr))
- **Rolldown** ([`zephyr-rolldown-plugin`](https://www.npmjs.com/package/zephyr-rolldown-plugin))
- **Astro** ([`zephyr-astro-integration`](https://www.npmjs.com/package/zephyr-astro-integration))
- **Nuxt** ([`zephyr-nuxt-module`](https://www.npmjs.com/package/zephyr-nuxt-module))
- **Modern.js** ([`zephyr-modernjs-plugin`](https://www.npmjs.com/package/zephyr-modernjs-plugin))
- **RSPress** ([`zephyr-rspress-plugin`](https://www.npmjs.com/package/zephyr-rspress-plugin))
- **Parcel** ([`parcel-reporter-zephyr`](https://www.npmjs.com/package/parcel-reporter-zephyr))
- **RSBuild** ([`zephyr-rsbuild-plugin`](https://www.npmjs.com/package/zephyr-rsbuild-plugin))
- **RSLib** ([`zephyr-rsbuild-plugin`](https://www.npmjs.com/package/zephyr-rsbuild-plugin))
- **Rstack CLI** (`zephyr-rsbuild-plugin` for apps/libraries, `zephyr-rspress-plugin` for docs)
- **Metro** (React Native) ([`zephyr-metro-plugin`](https://www.npmjs.com/package/zephyr-metro-plugin))
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
3. Add the appropriate Zephyr integration
4. Add the necessary import/require statements when applicable

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

### Rstack CLI

Run the codemod from the project or workspace root:

```bash
pnpm dlx with-zephyr --bundlers rstack --dry-run
pnpm dlx with-zephyr --bundlers rstack
```

It recognizes `rstack.config.ts`, `.js`, `.mts`, and `.mjs` and configures each
build section independently. `define.app()` and `define.lib()` use
`zephyr-rsbuild-plugin`; `define.doc()` uses `zephyr-rspress-plugin`.
Test, lint, formatting, and staged-file settings remain unchanged.

```ts
import { define } from 'rstack';
import { withZephyr as withZephyrRsbuild } from 'zephyr-rsbuild-plugin';
import { withZephyr as withZephyrRspress } from 'zephyr-rspress-plugin';

define.app({ plugins: [withZephyrRsbuild()] });
define.doc({ root: 'docs', plugins: [withZephyrRspress()] });
```

Inline objects and synchronous or asynchronous functions returning inline
objects are supported. Imported configuration objects or functions and spreads
without an explicit `plugins` property require manual setup; the codemod reports
them instead of replacing inherited configuration. Custom filenames passed to
Rstack's `--config` option are not discovered automatically.

Place configuration spreads before an explicit `plugins` property. Spreads
after it could replace the new plugin list, so those configurations also require
manual setup.

Existing Zephyr calls are checked per section, including import aliases and
options, so configuring an app does not prevent docs from being configured.
Dependencies are added to the nearest project manifest, and `--dry-run` changes
neither configuration files nor manifests.

Malformed Rstack files are reported individually without blocking other config
files. A `--bundlers` filter excludes unselected tools before their files are parsed.

The added plugins publish when their build runs. If ordinary local builds must
remain credential-free, gate the plugin list behind an explicit deployment flag:

```ts
define.app({
  plugins: [...(process.env.ZEPHYR_DEPLOY === 'true' ? [withZephyrRsbuild()] : [])],
});
```

Use `ZEPHYR_DEPLOY=true` only in the deployment command or workflow. For Rspress,
follow the plugin's typed configuration guidance when adding a conditional list.

### Options

- `[directory]` - Directory to search for config files (default: current directory)
- `-d, --dry-run` - Show what would be changed without modifying files
- `-b, --bundlers <bundlers...>` - Only process specific bundlers

> The codemod stages missing packages in `package.json`, applies file changes, then runs one install pass with your detected package manager (npm/yarn/pnpm/bun). In `--dry-run` it only lists what would be installed.

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

- **npm**: `npm install`
- **yarn**: `yarn install`
- **pnpm**: `pnpm install`
- **bun**: `bun install`

### Package Installation Behavior

- `npx with-zephyr` will install any required Zephyr plugins that are missing.
- The codemod applies config/script/file changes first, then installs dependencies once.
- `npx with-zephyr --dry-run` will list the packages it would install without making changes.

## Configuration File Detection

The codemod automatically detects and processes these configuration files:

- `webpack.config.js/ts/mjs`
- `rspack.config.js/ts/mjs`
- `vite.config.js/ts/mjs`
- `rollup.config.js/ts/mjs`
- `rolldown.config.js/ts/mjs`
- `astro.config.js/ts/mjs/mts`
- `nuxt.config.js/ts/mjs/mts`
- `modern.config.js/ts/mjs`
- `rspress.config.js/ts/mjs`
- `rsbuild.config.js/ts/mjs`
- `rslib.config.js/ts/mjs/cjs/mts/cts`
- `metro.config.js/ts/mjs/cjs`
- `.parcelrc/.parcelrc.json`

## Integration Patterns

The codemod recognizes and handles various configuration patterns:

### Webpack/Rspack

- `composePlugins()` calls (Nx style)
- `plugins: []` arrays
- Direct `module.exports` assignments

### Metro (React Native)

- `module.exports = ...` config exports (wrapped with async `withZephyr` call)
- Publication commands are registered only when `metro.config.*` already uses
  `withModuleFederation` from `@module-federation/metro`; Module Federation is
  never scaffolded automatically
- React Native CLI projects get `bundle-mf-host` and `bundle-mf-remote` through
  the existing `react-native.config.js`, `.cjs`, `.ts`, or `.mjs` file
- RNEF projects register `zephyrMetroRNEFPlugin` in the active
  `rnef.config.js`, `.ts`, or `.mjs` file
- Ambiguous React Native CLI/RNEF projects are left unchanged and receive manual
  registration instructions
- Each Metro project's own `package.json` receives `zephyr-metro-plugin@^1.4.0`
  and `@module-federation/metro@^2.9.0`; a workspace install can still run once
  at the invocation root
- Command registration follows `@module-federation/metro@2.9.0`'s peer contract:
  React 19+, React Native 0.79+, `@babel/types` at `>=7.25.0 <8.0.0`, plus
  `metro`, `metro-config`, `metro-file-map`, `metro-resolver`, and
  `metro-source-map` all at `>=0.82.1 <0.83.0`

The Metro `withZephyr` wrapper is configuration-only; publication happens only
when a registered bundle command completes its upload.

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

### Nuxt

- `defineNuxtConfig()` modules arrays
- Plain `export default {}` config objects

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

If the codemod doesn't work for your specific configuration, you can manually add the Zephyr integration:

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
pnpm --filter with-zephyr build
node ./libs/with-zephyr/dist/index.js --bundlers rspack /path/to/project
node ./libs/with-zephyr/dist/index.js --bundlers repack /path/to/react-native-project
```

### Project Structure

```
src/
├── bundlers/          # Per-bundler configs + registry
├── engine/            # ast-grep execution layer
├── operations.ts      # Ordered operation handlers per bundler
├── package-manager.ts # Package management utilities
├── index.ts           # CLI entry point and orchestration
└── types.ts           # Shared types
```

## Contributing

Found a configuration pattern that isn't supported? Please open an issue or submit a pull request!

## Optional Change Attribution

After setup, interactive runs ask whether to enable Change Attribution and link
to [Git AI installation](https://usegitai.com/docs/get-started). A second prompt
offers project agent hooks. Skipping either choice keeps ordinary Zephyr setup
working. Non-interactive runs require explicit flags:

```bash
pnpm dlx with-zephyr . --attribution --attribution-agents codex claude grok
```

`--no-attribution` skips the offer. `--dry-run` does not write attribution or hook
configuration. `--git-ai-path <executable>` selects a compatible Git AI binary or
fork. Git AI 1.7.x is supported, tested with 1.7.5. The codemod does not download
or execute its installer.

The opt-in writes `.zephyr/attribution.json` at the Git repository root. Agent
integration flags merge hooks into `.codex/hooks.json`, `.claude/settings.json`, or
`.grok/hooks/zephyr-attribution.json`; Codex/Grok also install a project metadata collector
without replacing existing hooks, global settings, or trust. Review Codex hooks
with `/hooks`; Grok requires `/hooks-trust`. Restart agent sessions. Git AI editor integrations are needed
for known-human evidence; missing instrumentation remains unknown.

Storage defaults to local: all attribution stays in the private Git directory
and is omitted from uploaded snapshots/build stats. `--attribution-storage remote`
selects dedicated build-linked publication, requiring authenticated repository
policy and the new control-plane endpoint. Free remote accounts include patches
and changed-line text; paid/BYOC defaults omit both, with independent opt-in.
Snapshots carry only an acknowledged remote record reference. The prompt
initiator comes from the launcher's `ZE_ATTRIBUTION_INITIATOR`
self-report, separately from the Git author and deployer. `ZE_ATTRIBUTION_HARNESS`
identifies wrappers such as T3. Session-cumulative usage/cost snapshots are not additive.
Grok tool-to-prompt linkage is explicitly inferred from the active prompt. The scoped source record includes
eligible unstaged and untracked files and omits ignored files, common build
output, `.env*`, private key files, `.npmrc`, and `.netrc`. Configure additional
repository-relative prefix exclusions through the `exclude` array. See the
bundled `zephyr-core/references/change-attribution.md` for limits and comparisons.
The companion `attribution-storage.md` describes per-repo preferences, a private
local-only override, and the server authorization/encrypted-storage contract.
