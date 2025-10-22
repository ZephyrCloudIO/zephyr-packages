# Zephyr Rsbuild Plugin

<div align="center">

[Zephyr Cloud](https://zephyr-cloud.io) | [Zephyr Docs](https://docs.zephyr-cloud.io/bundlers/rsbuild) | [Discord](https://zephyr-cloud.io/discord) | [Twitter](https://x.com/ZephyrCloudIO) | [LinkedIn](https://www.linkedin.com/company/zephyr-cloud/)

<hr/>
<img src="https://cdn.prod.website-files.com/669061ee3adb95b628c3acda/66981c766e352fe1f57191e2_Opengraph-zephyr.png" alt="Zephyr Logo" />
</div>

An Rsbuild plugin for deploying applications with Zephyr Cloud. This plugin integrates seamlessly with Rsbuild's fast bundling to enable deployment of your applications with Module Federation support.

## Get Started

The fastest way to get started is to use `create-zephyr-apps` to generate a new Rsbuild application with Zephyr integration:

```bash
npx create-zephyr-apps@latest
```

For more information please refer to our [documentation](https://docs.zephyr-cloud.io/bundlers/rsbuild).

## Installation

```bash
# npm
npm install --save-dev zephyr-rsbuild-plugin

# yarn
yarn add --dev zephyr-rsbuild-plugin

# pnpm
pnpm add --save-dev zephyr-rsbuild-plugin

# bun
bun add --dev zephyr-rsbuild-plugin
```

## Usage

### Basic Setup

Add the plugin to your Rsbuild configuration:

```javascript
// rsbuild.config.js
import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';
import { withZephyr } from 'zephyr-rsbuild-plugin';

export default defineConfig({
  plugins: [
    pluginReact(),
    withZephyr(), // Add Zephyr plugin
  ],
});
```

### With Options

```javascript
// rsbuild.config.js
import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';
import { withZephyr } from 'zephyr-rsbuild-plugin';

export default defineConfig({
  plugins: [
    pluginReact(),
    withZephyr({
      wait_for_index_html: true, // Wait for HTML processing
    }),
  ],
});
```

### TypeScript Configuration

```typescript
// rsbuild.config.ts
import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';
import { withZephyr } from 'zephyr-rsbuild-plugin';

export default defineConfig({
  plugins: [pluginReact(), withZephyr()],
});
```

### With Module Federation

```typescript
// rsbuild.config.ts
import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';
import { pluginModuleFederation } from '@module-federation/rsbuild-plugin';
import { withZephyr } from 'zephyr-rsbuild-plugin';

export default defineConfig({
  plugins: [
    pluginReact(),
    pluginModuleFederation({
      name: 'my-app',
      remotes: {
        'shared-ui': 'shared_ui@http://localhost:3001/remoteEntry.js',
      },
      shared: {
        react: { singleton: true },
        'react-dom': { singleton: true },
      },
    }),
    withZephyr(), // Add after Module Federation
  ],
});
```

## Features

- 🚀 Fast builds with Rsbuild's Rust-based bundler
- 🏗️ Full Module Federation support
- 📦 Automatic asset optimization and caching
- 🔧 Zero-config setup for simple applications
- 📊 Build analytics and monitoring
- 🌐 Global CDN distribution
- ⚡ Hot module replacement in development
- 🎯 Simple plugin integration

## Module Federation Support

This plugin provides comprehensive Module Federation support:

- **Host Applications**: Consume remote modules from other applications
- **Remote Applications**: Expose modules for consumption by host applications
- **Shared Dependencies**: Efficient sharing of common libraries
- **Dynamic Imports**: Runtime loading of remote modules
- **Automatic Vendor Federation**: Smart dependency sharing

## Getting Started

1. Install the plugin in your Rsbuild project
2. Add it to your Rsbuild configuration plugins array
3. Configure Module Federation (if needed) for microfrontends
4. Build your application with `npm run build`
5. Your app will be automatically deployed to Zephyr Cloud

## Build Scripts

Add these scripts to your `package.json`:

```json
{
  "scripts": {
    "dev": "rsbuild dev",
    "build": "rsbuild build",
    "preview": "rsbuild preview"
  }
}
```

## Requirements

- Rsbuild 1.0 or higher
- Node.js 18 or higher
- Zephyr Cloud account (sign up at [zephyr-cloud.io](https://zephyr-cloud.io))

## Examples

Check out our [examples directory](../../examples/) for complete working examples:

- [rsbuild-sample-app](../../examples/rsbuild-sample-app/) - Basic Rsbuild setup with Zephyr

## API Reference

### withZephyr(options?)

Creates an Rsbuild plugin for Zephyr integration.

#### Parameters

- `options` (optional): Configuration options
  - `wait_for_index_html?: boolean` - Wait for HTML processing before deployment

#### Returns

An Rsbuild plugin that can be added to the plugins array.

## Contributing

We welcome contributions! Please read our [contributing guidelines](../../CONTRIBUTING.md) for more information.

## License

Licensed under the Apache-2.0 License. See [LICENSE](LICENSE) for more information.
