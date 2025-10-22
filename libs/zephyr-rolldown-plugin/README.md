# Zephyr Rolldown Plugin

<div align="center">

[Zephyr Cloud](https://zephyr-cloud.io) | [Zephyr Docs](https://docs.zephyr-cloud.io) | [Discord](https://zephyr-cloud.io/discord) | [Twitter](https://x.com/ZephyrCloudIO) | [LinkedIn](https://www.linkedin.com/company/zephyr-cloud/)

<hr/>
<img src="https://cdn.prod.website-files.com/669061ee3adb95b628c3acda/66981c766e352fe1f57191e2_Opengraph-zephyr.png" alt="Zephyr Logo" />
</div>

A Rolldown plugin for deploying applications with Zephyr Cloud. This plugin enables seamless deployment of your Rolldown-built applications to Zephyr's global edge network.

For more information, please refer to our [documentation](https://docs.zephyr-cloud.io/bundlers/rolldown) for rolldown.

> **Note**: This plugin is currently in development (WIP - Work In Progress).

## Installation

```bash
# npm
npm install --save-dev zephyr-rolldown-plugin

# yarn
yarn add --dev zephyr-rolldown-plugin

# pnpm
pnpm add --dev zephyr-rolldown-plugin

# bun
bun add --dev zephyr-rolldown-plugin
```

## Usage

Add the plugin to your Rolldown configuration:

```javascript
// rolldown.config.mjs
import { defineConfig } from 'rolldown';
import { withZephyr } from 'zephyr-rolldown-plugin';

export default defineConfig({
  input: 'src/main.tsx',
  plugins: [
    {
      name: 'emit-html',
      generateBundle() {
        const html = `
          <html>
            <body>
              <div id="root"></div>
              <script type="module" src="./main.js"></script>
            </body>
          </html>
        `;
        this.emitFile({
          type: 'asset',
          fileName: 'index.html',
          source: html,
        });
      },
    },
    withZephyr(), // Add Zephyr plugin
  ],
});
```

### TypeScript Configuration

```typescript
// rolldown.config.ts
import { defineConfig } from 'rolldown';
import { withZephyr } from 'zephyr-rolldown-plugin';

export default defineConfig({
  input: 'src/main.tsx',
  plugins: [
    // ... other plugins
    withZephyr(),
  ],
});
```

## Features

- 🚀 Automatic deployment during build
- 📦 Asset optimization and bundling with Rolldown
- 🔧 Zero-config setup
- 📊 Build analytics and monitoring
- 🌐 Global CDN distribution
- ⚡ Fast builds with Rolldown's Rust-based bundler

## Getting Started

1. Install the plugin in your Rolldown project
2. Add it to your Rolldown configuration
3. Build your application as usual
4. Your app will be automatically deployed to Zephyr Cloud

## Build Scripts

Add these scripts to your `package.json`:

```json
{
  "scripts": {
    "dev": "rolldown --watch",
    "build": "rolldown",
    "build:prod": "NODE_ENV=production rolldown"
  }
}
```

## Requirements

- Rolldown (latest version)
- Node.js 18 or higher
- Zephyr Cloud account (sign up at [zephyr-cloud.io](https://zephyr-cloud.io))

## Status

This plugin is currently in active development. Features and API may change as Rolldown evolves. We're working closely with the Rolldown team to ensure optimal integration.

## Examples

Check out our [examples directory](../../examples/) for complete working examples:

- [rolldown-react](../../examples/rolldown-react/) - Basic React setup with Rolldown and Zephyr

## Contributing

We welcome contributions! Please read our [contributing guidelines](../../CONTRIBUTING.md) for more information.

## License

Licensed under the Apache-2.0 License. See [LICENSE](LICENSE) for more information.
