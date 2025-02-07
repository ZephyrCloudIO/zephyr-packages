# zephyr-webpack-plugin

<div align="center">

[Zephyr Cloud](https://zephyr-cloud.io) | [Zephyr Docs](https://docs.zephyr-cloud.io/recipes/rspack-react) | [Rspack Docs](https://rspack.dev) | [Discord](https://zephyr-cloud.io/discord) | [Twitter](https://x.com/ZephyrCloudIO) | [LinkedIn](https://www.linkedin.com/company/zephyr-cloud/)

<hr/>
</div>

## Installation

```
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

### With Nx, Webpack or Rspack

```
export default composePlugins(
  withNx(),
  withReact(),
  withModuleFederation(mfConfig),
  withZephyr(),
  (config) => {
    return config;
  }
);
```

### With Webpack directly

```
module.exports = withZephyr()(your_webpack_config);

```
