# Zephyr Rspack Plugin

<div align="center">

[Zephyr Cloud](https://zephyr-cloud.io) | [Zephyr Docs](https://docs.zephyr-cloud.io/bundlers/rspack) | [Discord](https://zephyr-cloud.io/discord) | [Twitter](https://x.com/ZephyrCloudIO) | [LinkedIn](https://www.linkedin.com/company/zephyr-cloud/)

<hr/>
<img src="https://cdn.prod.website-files.com/669061ee3adb95b628c3acda/66981c766e352fe1f57191e2_Opengraph-zephyr.png" alt="Zephyr Logo" />
</div>

An Rspack plugin for deploying applications with Zephyr Cloud. This plugin integrates seamlessly with Rspack's fast bundling to enable deployment of your applications with Module Federation support. Read more from our documentation [here](https://docs.zephyr-cloud.io/integrations/react-rspack-nx).

## Get Started

The fastest way to get started is to use to use `create-zephyr-apps` to generate a new Webpack application with Zephyr integration and choose from various rspack example:

```bash
npx create-zephyr-apps@latest
```

For more information please refer to our [documentation](https://docs.zephyr-cloud.io/bundlers/rspack).

## Installation

```bash
# npm
npm install --save-dev zephyr-rspack-plugin

# yarn
yarn add --dev zephyr-rspack-plugin

# pnpm
pnpm add --save-dev zephyr-rspack-plugin

# bun
bun add --dev zephyr-rspack-plugin
```

## Usage

### With Nx and Rspack

For Nx projects using Rspack:

```javascript
// rspack.config.js
import { composePlugins, withNx } from '@nx/rspack';
import { withReact } from '@nx/react';
import { withModuleFederation } from '@nx/rspack/module-federation';
import { withZephyr } from 'zephyr-rspack-plugin';

const mfConfig = {
  name: 'my-app',
  remotes: {
    'shared-ui': 'shared_ui@http://localhost:3001/remoteEntry.js',
  },
  shared: {
    react: { singleton: true },
    'react-dom': { singleton: true },
  },
};

export default composePlugins(
  withNx(),
  withReact(),
  withModuleFederation(mfConfig),
  withZephyr(), // Add Zephyr plugin
  (config) => {
    return config;
  }
);
```

### With Rspack Directly

For standalone Rspack projects:

```javascript
// rspack.config.js
const { withZephyr } = require('zephyr-rspack-plugin');

const config = {
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].[contenthash].js',
  },
  // ... other Rspack configuration
};

module.exports = withZephyr()(config);
```

### TypeScript Configuration

```typescript
// rspack.config.ts
import { Configuration } from '@rspack/core';
import { withZephyr } from 'zephyr-rspack-plugin';

const config: Configuration = {
  entry: './src/index.tsx',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].[contenthash].js',
  },
  // ... other configuration
};

export default withZephyr()(config);
```

## Features

- 🚀 Fast builds with Rspack's Rust-based bundler
- 🏗️ Full Module Federation support
- 📦 Automatic asset optimization and caching
- 🔧 Zero-config setup for simple applications
- 📊 Build analytics and monitoring
- 🌐 Global CDN distribution
- ⚡ Hot module replacement in development
- 🎯 Nx integration for monorepo support

## Module Federation Support

This plugin provides comprehensive Module Federation support:

- **Host Applications**: Consume remote modules from other applications
- **Remote Applications**: Expose modules for consumption by host applications
- **Shared Dependencies**: Efficient sharing of common libraries
- **Dynamic Imports**: Runtime loading of remote modules
- **Automatic Vendor Federation**: Smart dependency sharing

## Getting Started

1. Install the plugin in your Rspack project
2. Add it to your Rspack configuration
3. Configure Module Federation (if needed) for microfrontends
4. Build your application with `npm run build`
5. Your app will be automatically deployed to Zephyr Cloud

## Build Scripts

Add these scripts to your `package.json`:

```json
{
  "scripts": {
    "dev": "rspack serve",
    "build": "rspack build",
    "build:prod": "NODE_ENV=production rspack build"
  }
}
```

## Requirements

- Rspack 0.3 or higher
- Node.js 18 or higher
- Zephyr Cloud account (sign up at [zephyr-cloud.io](https://zephyr-cloud.io))

## Examples

Check out our [examples directory](../../examples/) for complete working examples:

- [rsbuild-sample-app](../../examples/rsbuild-sample-app/) - Basic Rsbuild setup
- [rspack-mf](../../examples/rspack-mf/) - Module Federation setup with host and remote
- [rspack-nx-mf](../../examples/rspack-nx-mf/) - Nx workspace with Rspack and Module Federation

## Nx Integration

This plugin works seamlessly with Nx workspaces:

```bash
# Generate a new Rspack app with Module Federation
nx g @nx/rspack:app my-app --mf=true

# Add Zephyr plugin to the generated configuration
```

## Contributing

We welcome contributions! Please read our [contributing guidelines](../../CONTRIBUTING.md) for more information.

## License

Licensed under the Apache-2.0 License. See [LICENSE](LICENSE) for more information.
