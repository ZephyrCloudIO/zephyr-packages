# Rollup Plugin Zephyr

<div align="center">

[Zephyr Cloud](https://zephyr-cloud.io) | [Zephyr Docs](https://docs.zephyr-cloud.io) | [Discord](https://zephyr-cloud.io/discord) | [Twitter](https://x.com/ZephyrCloudIO) | [LinkedIn](https://www.linkedin.com/company/zephyr-cloud/)

<hr/>
<img src="https://cdn.prod.website-files.com/669061ee3adb95b628c3acda/66981c766e352fe1f57191e2_Opengraph-zephyr.png" alt="Zephyr Logo" />
</div>

A Rollup plugin for deploying applications with Zephyr Cloud. This plugin enables seamless deployment of your Rollup-built applications to Zephyr's global edge network.

## Installation

```bash
# npm
npm install --save-dev rollup-plugin-zephyr

# yarn
yarn add --dev rollup-plugin-zephyr

# pnpm
pnpm add --dev rollup-plugin-zephyr

# bun
bun add --dev rollup-plugin-zephyr
```

## AI Agent Skills (Optional)

This package ships the `zephyr-rollup` Agent Skill for AI coding agents, together
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

Allow `rollup-plugin-zephyr` when `install` asks. Intent saves that choice in the
`intent.skills` allowlist in your `package.json`. To check or load the skill
yourself:

```sh
pnpm exec intent list
pnpm exec intent load 'rollup-plugin-zephyr#zephyr-rollup'
```

## Usage

Add the plugin to your Rollup configuration:

```javascript
// rollup.config.js
import { zephyrPlugin } from 'rollup-plugin-zephyr';

export default {
  input: 'src/main.js',
  output: {
    dir: 'dist',
    format: 'es',
  },
  plugins: [
    // ... other plugins
    zephyrPlugin(),
  ],
};
```

### With ES Modules

```javascript
// rollup.config.mjs
import { zephyrPlugin } from 'rollup-plugin-zephyr';

export default {
  input: 'src/main.js',
  output: {
    dir: 'dist',
    format: 'es',
  },
  plugins: [
    zephyrPlugin({
      // Configuration options
    }),
  ],
};
```

### TypeScript Configuration

```typescript
// rollup.config.ts
import { defineConfig } from 'rollup';
import { zephyrPlugin } from 'rollup-plugin-zephyr';

export default defineConfig({
  input: 'src/main.ts',
  output: {
    dir: 'dist',
    format: 'es',
  },
  plugins: [zephyrPlugin()],
});
```

### TAP Module Federation metadata

Rollup does not discover independently published TAP containers. For a `tap-app`
build, pass the SDK-produced config and build-stat records together:

```ts
import { withZephyr } from 'rollup-plugin-zephyr';

withZephyr({
  target: 'tap-app',
  mfConfigs: [
    { name: 'desktop', filename: 'targets/desktop/remoteEntry.mjs' },
    { name: 'quickjs', filename: 'targets/quickjs/remoteEntry.mjs' },
  ],
  federation: [
    { name: 'desktop', remote: 'targets/desktop/remoteEntry.mjs', library_type: 'module' },
    { name: 'quickjs', remote: 'targets/quickjs/remoteEntry.mjs', library_type: 'module' },
  ],
});
```

Both arrays must be non-empty, have the same containers, and pair each `name` with
`filename === remote`. The plugin rejects incomplete or mismatched TAP metadata. A
single valid container also supplies the legacy `mfConfig`; multi-container builds
retain only the full arrays rather than choosing an arbitrary container.

## Features

- 🚀 Automatic deployment during build
- 📦 Asset optimization and bundling
- 🔧 Zero-config setup
- 📊 Build analytics and monitoring
- 🌐 Global CDN distribution
- ⚡ Edge caching and optimization

## Getting Started

1. Install the plugin in your Rollup project
2. Add it to your Rollup configuration
3. Build your application as usual with `rollup -c`
4. Your app will be automatically deployed to Zephyr Cloud

## Build Scripts

Add these scripts to your `package.json`:

```json
{
  "scripts": {
    "dev": "rollup -c -w",
    "build": "rollup -c",
    "build:prod": "NODE_ENV=production rollup -c"
  }
}
```

## Requirements

- Rollup 2.x or higher
- Node.js 14 or higher
- Zephyr Cloud account (sign up at [zephyr-cloud.io](https://zephyr-cloud.io))

## Contributing

We welcome contributions! Please read our [contributing guidelines](../../CONTRIBUTING.md) for more information.

## License

Licensed under the Apache-2.0 License. See [LICENSE](LICENSE) for more information.
