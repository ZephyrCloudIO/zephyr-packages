# Vite Plugin Zephyr

<div align="center">

[Zephyr Cloud](https://zephyr-cloud.io) | [Zephyr Docs](https://docs.zephyr-cloud.io) | [Discord](https://zephyr-cloud.io/discord) | [Twitter](https://x.com/ZephyrCloudIO) | [LinkedIn](https://www.linkedin.com/company/zephyr-cloud/)

<hr/>
<img src="https://cdn.prod.website-files.com/669061ee3adb95b628c3acda/66981c766e352fe1f57191e2_Opengraph-zephyr.png" alt="Zephyr Logo" />
</div>

A Vite plugin for deploying applications with Zephyr Cloud. This plugin integrates with Vite's build process to enable seamless deployment of your applications with Module Federation support. Read more from our documentation [here](https://docs.zephyr-cloud.io/recipes/react-vite).

## Installation

```bash
# npm
npm install --save-dev vite-plugin-zephyr

# yarn
yarn add --dev vite-plugin-zephyr

# pnpm
pnpm add --dev vite-plugin-zephyr

# bun
bun add --dev vite-plugin-zephyr
```

## Usage

### Basic Configuration

Add the plugin to your Vite configuration:

```javascript
// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { withZephyr } from 'vite-plugin-zephyr';

export default defineConfig({
  plugins: [react(), withZephyr()],
  build: {
    target: 'chrome89',
  },
});
```

### With Module Federation

For microfrontend applications using Module Federation:

```javascript
// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { withZephyr, type ModuleFederationOptions } from 'vite-plugin-zephyr';

const mfConfig = {
  name: 'my-app',
  remotes: {
    shared: 'shared@http://localhost:3001/remoteEntry.js',
  },
  shared: {
    react: { singleton: true },
    'react-dom': { singleton: true },
  },
};

export default defineConfig({
  plugins: [
    react(),
    withZephyr({ mfConfig })
  ],
  build: {
    target: 'chrome89',
  },
});
```

### TypeScript Configuration

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { withZephyr, type ModuleFederationOptions } from 'vite-plugin-zephyr';

const mfConfig: ModuleFederationOptions = {
  name: 'host-app',
  remotes: {
    'remote-app': 'remoteApp@http://localhost:3001/remoteEntry.js',
  },
  shared: {
    react: { singleton: true },
    'react-dom': { singleton: true },
  },
};

export default defineConfig({
  plugins: [react(), withZephyr({ mfConfig })],
  build: {
    target: 'chrome89',
  },
});
```

## Features

- 🚀 Seamless deployment during Vite build
- 🏗️ Module Federation support via [@module-federation/vite](https://github.com/module-federation/vite)
- 📦 Asset optimization and caching
- 🔧 Zero-config setup for simple applications
- 📊 Build analytics and monitoring
- 🌐 Global CDN distribution
- ⚡ Hot module replacement in development

## Module Federation Support

This plugin uses the official [vite plugin from Module Federation](https://github.com/module-federation/vite) under the hood, providing:

- **Host Applications**: Consume remote modules from other applications
- **Remote Applications**: Expose modules for consumption by host applications
- **Shared Dependencies**: Efficient sharing of common libraries
- **Dynamic Imports**: Runtime loading of remote modules

## Getting Started

1. Install the plugin in your Vite project
2. Add it to your Vite configuration
3. Configure Module Federation (if needed) for microfrontends
4. Build your application with `vite build`
5. Your app will be automatically deployed to Zephyr Cloud

## Build Scripts

Add these scripts to your `package.json`:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

## Requirements

- Vite 4.x or higher
- Node.js 18 or higher
- Zephyr Cloud account (sign up at [zephyr-cloud.io](https://zephyr-cloud.io))

## Examples

Check out our [examples directory](../../examples/) for complete working examples:

- [vite-react-ts](../../examples/vite-react-ts/) - Basic React + TypeScript setup
- [vite-react-mf](../../examples/vite-react-mf/) - Module Federation setup with host and remote

## Contributing

We welcome contributions! Please read our [contributing guidelines](../../CONTRIBUTING.md) for more information.

## License

Licensed under the Apache-2.0 License. See [LICENSE](LICENSE) for more information.
