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

## Configuration

The plugin accepts the following options:

```javascript
zephyrPlugin({
  // Enable/disable deployment (default: true in production)
  deploy: true,

  // Custom deployment environment
  environment: 'production',

  // Additional metadata
  metadata: {
    version: '1.0.0',
    description: 'My awesome app',
  },
});
```

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
