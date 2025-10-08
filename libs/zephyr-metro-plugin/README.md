# Zephyr Metro Plugin

<div align="center">

[Zephyr Cloud](https://zephyr-cloud.io) | [Zephyr Docs](https://docs.zephyr-cloud.io/bundlers/metro) | [Discord](https://zephyr-cloud.io/discord) | [Twitter](https://x.com/ZephyrCloudIO) | [LinkedIn](https://www.linkedin.com/company/zephyr-cloud/)

<hr/>
<img src="https://cdn.prod.website-files.com/669061ee3adb95b628c3acda/66981c766e352fe1f57191e2_Opengraph-zephyr.png" alt="Zephyr Logo" />
</div>

A React Native Metro bundler plugin for deploying cross-platform applications with Zephyr Cloud. This plugin integrates seamlessly with Metro bundler and React Native to enable Over-The-Air (OTA) updates, Module Federation, and seamless deployment to Zephyr Cloud.

## Get Started

The fastest way to get started is to use `create-zephyr-apps` to generate a new React Native application with Zephyr integration:

```bash
npx create-zephyr-apps@latest
```

For more information, please refer to our [documentation](https://docs.zephyr-cloud.io/bundlers/metro) for Metro and comprehensive guides for React Native integration.

## Installation

Installing the `zephyr-metro-plugin` for your React Native application:

```bash
# npm
npm install --save-dev zephyr-metro-plugin

# yarn
yarn add --dev zephyr-metro-plugin

# pnpm
pnpm add --dev zephyr-metro-plugin

# bun
bun add --dev zephyr-metro-plugin
```

## Usage

### Basic Configuration

The Metro plugin provides two main integration points depending on your setup:

#### 1. Using `withZephyr` Config Wrapper

For Metro configuration file integration:

```javascript
// metro.config.js
const { getDefaultConfig } = require('@react-native/metro-config');
const { withZephyr } = require('zephyr-metro-plugin');

const mfConfig = {
  name: 'MyApp',
  remotes: {
    'shared-components': 'SharedComponents@http://localhost:9000/remoteEntry.js',
  },
  shared: {
    react: {
      singleton: true,
      eager: true,
    },
    'react-native': {
      singleton: true,
      eager: true,
    },
  },
};

module.exports = withZephyr(
  __dirname,
  'ios', // or 'android'
  'production', // or 'development'
  'dist'
)(mfConfig);
```

#### 2. Using Command Wrapper

For CLI-level integration with custom bundling commands:

```javascript
const { zephyrCommandWrapper } = require('zephyr-metro-plugin');

// Wrap your Metro bundling function
const wrappedBundleCommand = zephyrCommandWrapper(originalBundleFunction, loadMetroConfig, updateManifest);
```

### Module Federation Configuration

The plugin works with Metro's Module Federation setup. Configure your federated modules:

#### Host Application Example

```javascript
// metro.config.js
const mfConfig = {
  name: 'MobileHost',
  remotes: {
    MobileCart: 'MobileCart@http://localhost:9000/ios/MobileCart.bundle',
    MobileCheckout: 'MobileCheckout@http://localhost:9001/ios/MobileCheckout.bundle',
  },
  shared: {
    react: {
      singleton: true,
      eager: true,
      requiredVersion: '^18.0.0',
    },
    'react-native': {
      singleton: true,
      eager: true,
    },
  },
};
```

#### Remote/Mini-App Example

```javascript
// metro.config.js
const mfConfig = {
  name: 'MobileCart',
  filename: 'MobileCart.bundle',
  exposes: {
    './CartScreen': './src/screens/CartScreen',
    './CartWidget': './src/components/CartWidget',
  },
  shared: {
    react: {
      singleton: true,
      eager: false,
    },
    'react-native': {
      singleton: true,
      eager: false,
    },
  },
};
```

### Platform-Specific Configuration

The plugin supports both iOS and Android platforms:

```javascript
const platform = process.env.PLATFORM || 'ios'; // 'ios' or 'android'
const mode = process.env.NODE_ENV || 'development';

module.exports = withZephyr(__dirname, platform, mode, 'dist')(mfConfig);
```

### Build Scripts

Add these scripts to your `package.json`:

```json
{
  "scripts": {
    "ios": "react-native run-ios",
    "android": "react-native run-android",
    "build:ios": "PLATFORM=ios NODE_ENV=production react-native bundle",
    "build:android": "PLATFORM=android NODE_ENV=production react-native bundle"
  }
}
```

## Features

- 📱 **Cross-platform React Native support** - iOS and Android
- 🚀 **Over-The-Air (OTA) updates** - Deploy updates without app store releases
- 🏗️ **Module Federation support** - Share code between micro-frontends
- ⚡ **Metro bundler integration** - Works seamlessly with Metro's fast refresh
- 🔧 **Zero-config setup** - Minimal configuration required
- 📊 **Build analytics and monitoring** - Track deployments and performance
- 🌐 **Global CDN distribution** - Fast asset delivery worldwide
- 🔄 **Hot Module Replacement** - Development workflow with fast refresh

## Over-The-Air (OTA) Updates

For detailed information about implementing OTA updates with the Metro plugin, see [OTA_SETUP.md](./OTA_SETUP.md).

Key OTA features:

- Automatic update checks
- Silent background updates
- Rollback capabilities
- Version management
- Platform-specific updates

## Project Structure

Your React Native Metro project should follow this structure:

```
my-react-native-app/
├── android/
├── ios/
├── src/
│   ├── components/
│   ├── screens/
│   └── App.tsx
├── metro.config.js
├── package.json
└── index.js
```

## Requirements

- **React Native**: 0.70 or higher
- **Metro**: 0.80 or higher
- **Node.js**: 18 or higher
- **Zephyr Cloud account**: Sign up at [zephyr-cloud.io](https://zephyr-cloud.io)

## Advanced Configuration

### Custom Output Directory

```javascript
module.exports = withZephyr(
  __dirname,
  'ios',
  'production',
  'custom-dist' // Custom output directory
)(mfConfig);
```

### Development vs Production

```javascript
const isDev = process.env.NODE_ENV === 'development';

module.exports = withZephyr(__dirname, 'ios', isDev ? 'development' : 'production', 'dist')(mfConfig);
```

## Troubleshooting

### Missing Metro Federation Config

If you see `ERR_MISSING_METRO_FEDERATION_CONFIG`, ensure your Module Federation config is properly set up:

```javascript
// Set global config before bundling
global.__METRO_FEDERATION_CONFIG = mfConfig;
```

### Platform-Specific Issues

Make sure to specify the correct platform when building:

```bash
# iOS
PLATFORM=ios react-native bundle

# Android
PLATFORM=android react-native bundle
```

### Asset Loading Issues

Ensure your output directory is correctly configured and accessible:

```javascript
module.exports = withZephyr(
  __dirname,
  platform,
  mode,
  'dist' // Must match your Metro output path
)(mfConfig);
```

## Examples

Check out our [examples directory](../../examples/) for complete working examples:

- [metro-react-native](../../examples/metro-react-native/) - Complete React Native setup with Zephyr

## API Reference

### `withZephyr(context, platform, mode, outDir)`

Main configuration wrapper for Metro config.

**Parameters:**

- `context` (string): Project root directory (typically `__dirname`)
- `platform` ('ios' | 'android'): Target platform
- `mode` ('development' | 'production'): Build mode
- `outDir` (string): Output directory for built assets (default: 'dist')

**Returns:** Function that accepts Module Federation config

### `zephyrCommandWrapper(bundleFn, loadConfigFn, updateManifestFn)`

Advanced CLI-level integration wrapper.

**Parameters:**

- `bundleFn` (function): Original Metro bundle function
- `loadConfigFn` (function): Metro config loader function
- `updateManifestFn` (function): Manifest update function

**Returns:** Wrapped bundling function with Zephyr integration

## Contributing

We welcome contributions! Please read our [contributing guidelines](../../CONTRIBUTING.md) for more information.

## License

Licensed under the Apache-2.0 License. See [LICENSE](LICENSE) for more information.

## Support

- **Documentation**: [docs.zephyr-cloud.io](https://docs.zephyr-cloud.io)
- **Discord**: [Join our community](https://zephyr-cloud.io/discord)
- **GitHub Issues**: [Report bugs](https://github.com/ZephyrCloudIO/zephyr-packages/issues)
- **Twitter**: [@ZephyrCloudIO](https://x.com/ZephyrCloudIO)
