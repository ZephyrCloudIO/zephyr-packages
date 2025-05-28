# Zephyr Repack Plugin

<div align="center">

[Zephyr Cloud](https://zephyr-cloud.io) | [Zephyr Docs](https://docs.zephyr-cloud.io/recipes/repack-mf) | [Discord](https://zephyr-cloud.io/discord) | [Twitter](https://x.com/ZephyrCloudIO) | [LinkedIn](https://www.linkedin.com/company/zephyr-cloud/)

<hr/>
<img src="https://cdn.prod.website-files.com/669061ee3adb95b628c3acda/66981c766e352fe1f57191e2_Opengraph-zephyr.png" alt="Zephyr Logo" />
</div>

A React Native plugin for deploying cross-platform applications built with [React Native](https://reactnative.dev), [Rspack](https://rspack.dev) and [Re.Pack](https://re-pack.dev). This plugin enables Over-The-Air updates capabilities for federated applications and seamless deployment to Zephyr Cloud.

## Installation

Installing the `zephyr-repack-plugin` for your cross-platform application:

```
# npm
npm install --save-dev zephyr-repack-plugin
# yarn
yarn add --dev zephyr-repack-plugin
# pnpm
pnpm add --dev zephyr-repack-plugin
# bun
bun add --dev zephyr-repack-plugin
```

## Usage

Using `zephyr-repack-plugin` by wrapping the Rspack configuration:

```js
const { withZephyr } = require('zephyr-repack-plugin');

const config = {
  /** ...rspack configuration */
};

module.exports = withZephyr()(config);
```

With `zephyr-repack-plugin` you can continue to use the previous configuration from [Module Federation configuration](https://module-federation.io) (note that just the configuration, not the plugin). We recommend using the new [Re.Pack Module Federation](https://re-pack.dev/docs/module-federation) as it has better runtime support for cross-platform applications for usage with rspack and react native.

### Using Re.Pack

For usage with Re.Pack you can check out [Re.Pack's docs](https://re-pack.dev/docs/getting-started) - another reference of how to use it is [Callstack's Super App Showcase](https://github.com/callstack/super-app-showcase) and our [Repack Example](https://github.com/ZephyrCloudIO/zephyr-repack-example).

### Configuration for Module Federation

#### Continuation

1. You can continue to use previous configuration from [Module Federation configuration](https://module-federation.io) (note that just the configuration, not the plugin). We recommend using the new [Re.Pack Module Federation](https://re-pack.dev/docs/module-federation) as it has better runtime support for cross-platform applications for usage with rspack and react native.

```js
// rspack.config.js
plugins: [
  new Repack.plugins.ModuleFederationPluginV2({
    // your configuration
  }),
];
```

#### Host app/Consumer example

```js
// rspack.config.js
...
 new Repack.plugins.ModuleFederationPluginV2({
        /**
         * The name of the module is used to identify the module in URLs resolver and imports.
         */
        name: 'MobileHost',
        dts: false,
        remotes: {
          MobileCart: `MobileCart@http://localhost:9000/${platform}/MobileCart.container.js.bundle`,
          MobileInventory: `MobileInventory@http://localhost:9001/${platform}/MobileInventory.container.js.bundle`,
          MobileCheckout: `MobileCheckout@http://localhost:9002/${platform}/MobileCheckout.container.js.bundle`,
          MobileOrders: `MobileOrders@http://localhost:9003/${platform}/MobileOrders.container.js.bundle`,
        },
        /**
         * Shared modules are shared in the share scope.
         * React, React Native and React Navigation should be provided here because there should be only one instance of these modules.
         * Their names are used to match requested modules in this compilation.
         */
        shared: getSharedDependencies({eager: true}),
      }),
...

```

#### MiniApp/Provider example

```js
// rspack.config.js
...
   new Repack.plugins.ModuleFederationPluginV2({
        /**
         * The name of the module is used to identify the module in URLs resolver and imports.
         */
        name: 'MobileCheckout',
        filename: 'MobileCheckout.container.js.bundle',
        dts: false,
        /**
         * This is a list of modules that will be shared between remote containers.
         */
        exposes: {
          './CheckoutSection': './src/components/CheckoutSection',
          './CheckoutSuccessScreen': './src/screens/CheckoutSuccessScreen',
        },
        /**
         * Shared modules are shared in the share scope.
         * React, React Native and React Navigation should be provided here because there should be only one instance of these modules.
         * Their names are used to match requested modules in this compilation.
         */
        shared: getSharedDependencies({eager: STANDALONE}),
      }),
      ...
```

## Creation command

To create a complete example of a React Native application, with Zephyr enabled, configured, you can use our creation command where you can find most of our examples.

```bash
npx create-zephyr-apps@latest
```

This will create a new React Native application with Zephyr enabled, configured, and ready to use. [Read more about what this command would create here](https://docs.zephyr-cloud.io/recipes/repack-mf).

## Features

- 📱 Cross-platform React Native support (iOS, Android)
- 🚀 Over-The-Air (OTA) updates for federated applications
- 🏗️ Module Federation support with Re.Pack
- ⚡ Rspack for fast bundling and building
- 🔧 Zero-config setup with minimal configuration
- 📊 Build analytics and monitoring
- 🌐 Global CDN distribution for mobile assets

## Requirements

- React Native 0.70 or higher
- Re.Pack 3.x or higher
- Rspack 0.3 or higher
- Node.js 18 or higher
- Zephyr Cloud account (sign up at [zephyr-cloud.io](https://zephyr-cloud.io))

## Contributing

We welcome contributions! Please read our [contributing guidelines](../../CONTRIBUTING.md) for more information.

## License

Licensed under the Apache-2.0 License. See [LICENSE](LICENSE) for more information.
