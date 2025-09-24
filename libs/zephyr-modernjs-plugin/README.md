# Zephyr Modern.js Plugin

<div align="center">

[Zephyr Cloud](https://zephyr-cloud.io) | [Zephyr Docs](https://docs.zephyr-cloud.io) | [Discord](https://zephyr-cloud.io/discord) | [Twitter](https://x.com/ZephyrCloudIO) | [LinkedIn](https://www.linkedin.com/company/zephyr-cloud/)

<hr/>
<img src="https://cdn.prod.website-files.com/669061ee3adb95b628c3acda/66981c766e352fe1f57191e2_Opengraph-zephyr.png" alt="Zephyr Logo" />
</div>

A Modern.js plugin for deploying applications with Zephyr Cloud. This plugin integrates seamlessly with Modern.js framework to enable application federation and deployment capabilities.

## Get Started

The fastest way to get started is to use `create-zephyr-apps` to generate a new Modern.js application with Zephyr integration:

```bash
npx create-zephyr-apps@latest
```

For more information, please refer to our [documentation](https://docs.zephyr-cloud.io/meta-frameworks/modernjs) for Modern.js and Zephyr integration.

## Installation

```bash
# npm
npm install --save-dev zephyr-modernjs-plugin

# yarn
yarn add --dev zephyr-modernjs-plugin

# pnpm
pnpm add --dev zephyr-modernjs-plugin

# bun
bun add --dev zephyr-modernjs-plugin
```

## Usage

Add the plugin to your Modern.js configuration:

```typescript
// modern.config.ts
import { defineConfig } from '@modern-js/app-tools';
import { withZephyr } from 'zephyr-modernjs-plugin';

export default defineConfig({
  output: {
    distPath: {
      html: './',
    },
  },
  html: {
    outputStructure: 'flat',
  },
  source: {
    mainEntryName: 'index',
  },
  runtime: {
    router: true,
  },
  plugins: [
    appTools({
      bundler: 'rspack', // Set to 'webpack' to enable webpack
    }),
    withZephyr(), // Must be last
  ],
});
```

## Required Configuration

The plugin requires the following Modern.js configuration to work properly:

### Output Configuration

```typescript
output: {
  distPath: {
    html: './', // HTML files at root of dist
  },
}
```

### HTML Configuration

```typescript
html: {
  outputStructure: 'flat', // Flat structure for assets
}
```

### Source Configuration

```typescript
source: {
  mainEntryName: 'index', // Main entry point name
}
```

## Bundler Support

The plugin works with both Webpack and Rspack bundlers:

### With Rspack (Recommended)

```typescript
plugins: [
  appTools({
    bundler: 'rspack',
  }),
  withZephyr(),
];
```

### With Webpack

```typescript
plugins: [
  appTools({
    bundler: 'webpack',
  }),
  withZephyr(),
];
```

## Features

- 🚀 Seamless deployment during Modern.js build
- ⚡ Support for both Webpack and Rspack bundlers
- 📦 Automatic asset optimization
- 🏗️ Application federation capabilities
- 🔧 Zero-config setup with required configuration
- 📊 Build analytics and monitoring
- 🌐 Global CDN distribution

## Project Structure

Your Modern.js project should follow this structure:

```
my-modernjs-app/
├── src/
│   ├── routes/
│   │   ├── layout.tsx
│   │   └── page.tsx
│   └── index.ts
├── modern.config.ts
└── package.json
```

## Getting Started

1. Install the plugin in your Modern.js project
2. Add the required configuration to `modern.config.ts`
3. Add the plugin to your plugins array (ensure it's last)
4. Build your application with `npm run build`
5. Your app will be automatically deployed to Zephyr Cloud

## Build Scripts

Add these scripts to your `package.json`:

```json
{
  "scripts": {
    "dev": "modern dev",
    "build": "modern build",
    "serve": "modern serve"
  }
}
```

## Requirements

- Modern.js 2.x or higher
- Node.js 18 or higher
- Zephyr Cloud account (sign up at [zephyr-cloud.io](https://zephyr-cloud.io))

## Examples

Check out our [examples directory](../../examples/) for complete working examples:

- [modern-js](../../examples/modern-js/) - Complete Modern.js setup with Zephyr

## Contributing

We welcome contributions! Please read our [contributing guidelines](../../CONTRIBUTING.md) for more information.

## License

Licensed under the Apache-2.0 License. See [LICENSE](LICENSE) for more information.
