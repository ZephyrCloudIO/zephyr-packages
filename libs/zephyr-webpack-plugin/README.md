# Zephyr Webpack Plugin

<div align="center">

[Zephyr Cloud](https://zephyr-cloud.io) | [Zephyr Docs](https://docs.zephyr-cloud.io) | [Discord](https://zephyr-cloud.io/discord) | [Twitter](https://x.com/ZephyrCloudIO) | [LinkedIn](https://www.linkedin.com/company/zephyr-cloud/)

<hr/>
<img src="https://cdn.prod.website-files.com/669061ee3adb95b628c3acda/66981c766e352fe1f57191e2_Opengraph-zephyr.png" alt="Zephyr Logo" />
</div>

A Webpack plugin for deploying applications with Zephyr Cloud. This plugin integrates seamlessly with Webpack's ecosystem to enable deployment of your applications with comprehensive Module Federation support.

## Installation

```bash
# npm
npm install --save-dev zephyr-webpack-plugin

# yarn
yarn add --dev zephyr-webpack-plugin

# pnpm
pnpm add --dev zephyr-webpack-plugin

# bun
bun add --dev zephyr-webpack-plugin
```

## Usage

### With Nx and Webpack

For Nx projects using Webpack:

```javascript
// webpack.config.js
import { composePlugins, withNx } from '@nx/webpack';
import { withReact } from '@nx/react';
import { withModuleFederation } from '@nx/webpack/module-federation';
import { withZephyr } from 'zephyr-webpack-plugin';

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

### With Webpack Directly

For standalone Webpack projects:

```javascript
// webpack.config.js
const { withZephyr } = require('zephyr-webpack-plugin');

const config = {
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].[contenthash].js',
  },
  // ... other Webpack configuration
};

module.exports = withZephyr()(config);
```

### TypeScript Configuration

```typescript
// webpack.config.ts
import { Configuration } from 'webpack';
import { withZephyr } from 'zephyr-webpack-plugin';

const config: Configuration = {
  entry: './src/index.tsx',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].[contenthash].js',
  },
  // ... other configuration
};

export default withZephyr({
  // Zephyr options
  deploy: true,
  environment: 'production',
})(config);
```

### With Module Federation Plugin

```javascript
// webpack.config.js
const ModuleFederationPlugin = require('@module-federation/webpack');
const { withZephyr } = require('zephyr-webpack-plugin');

const config = {
  entry: './src/index.js',
  plugins: [
    new ModuleFederationPlugin({
      name: 'host',
      remotes: {
        mfe1: 'mfe1@http://localhost:3001/remoteEntry.js',
      },
      shared: {
        react: { singleton: true },
        'react-dom': { singleton: true },
      },
    }),
  ],
  // ... other configuration
};

module.exports = withZephyr()(config);
```

## Features

- 🏗️ Full Module Federation support with Webpack 5
- 📦 Automatic asset optimization and caching
- 🔧 Zero-config setup for simple applications
- 📊 Build analytics and monitoring
- 🌐 Global CDN distribution
- ⚡ Hot module replacement in development
- 🎯 Nx integration for monorepo support
- 🔗 Automatic vendor federation for shared dependencies

## Module Federation Support

This plugin provides comprehensive Module Federation support:

- **Host Applications**: Consume remote modules from other applications
- **Remote Applications**: Expose modules for consumption by host applications
- **Shared Dependencies**: Efficient sharing of common libraries
- **Dynamic Imports**: Runtime loading of remote modules
- **Automatic Vendor Federation**: Smart dependency sharing
- **Federation Dashboard**: Build-time federation analytics

## Getting Started

1. Install the plugin in your Webpack project
2. Add it to your Webpack configuration
3. Configure Module Federation (if needed) for microfrontends
4. Build your application with `npm run build`
5. Your app will be automatically deployed to Zephyr Cloud

## Build Scripts

Add these scripts to your `package.json`:

```json
{
  "scripts": {
    "dev": "webpack serve",
    "build": "webpack",
    "build:prod": "NODE_ENV=production webpack"
  }
}
```

## Advanced Configuration

### Custom Webpack Configuration

```javascript
// webpack.config.js
const { withZephyr } = require('zephyr-webpack-plugin');

const config = {
  entry: './src/index.js',
  optimization: {
    splitChunks: {
      chunks: 'all',
    },
  },
  resolve: {
    extensions: ['.js', '.jsx', '.ts', '.tsx'],
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx|ts|tsx)$/,
        exclude: /node_modules/,
        use: 'babel-loader',
      },
    ],
  },
};

module.exports = withZephyr({
  deploy: process.env.NODE_ENV === 'production',
  environment: process.env.NODE_ENV || 'development',
})(config);
```

## Requirements

- Webpack 5.x or higher
- Node.js 18 or higher
- Zephyr Cloud account (sign up at [zephyr-cloud.io](https://zephyr-cloud.io))

## Examples

Check out our [examples directory](../../examples/) for complete working examples:

- [sample-webpack-application](../../examples/sample-webpack-application/) - Basic Webpack setup
- [react-micro-frontends](../../examples/react-micro-frontends/) - Module Federation setup with multiple teams

## Nx Integration

This plugin works seamlessly with Nx workspaces:

```bash
# Generate a new Webpack app with Module Federation
nx g @nx/react:app my-app --bundler=webpack --mf=true

# Add Zephyr plugin to the generated configuration
```

## Contributing

We welcome contributions! Please read our [contributing guidelines](../../CONTRIBUTING.md) for more information.

## License

Licensed under the Apache-2.0 License. See [LICENSE](LICENSE) for more information.
