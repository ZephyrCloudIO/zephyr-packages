# zephyr-rspack-plugin

<div align="center">

[Zephyr Cloud](https://zephyr-cloud.io) | [Zephyr Docs](https://docs.zephyr-cloud.io/recipes/rspack-react) | [Rspack Docs](https://rspack.dev) | [Discord](https://zephyr-cloud.io/discord) | [Twitter](https://x.com/ZephyrCloudIO) | [LinkedIn](https://www.linkedin.com/company/zephyr-cloud/)

<hr/>
</div>

`zephyr-rspack-plugin` is a plugin to deploy application built with [Rspack](https://rspack.dev). Read more from our documentation [here](https://docs.zephyr-cloud.io/recipes/react-rspack-nx).

## Installation

```
# npm
npm install --save-dev zephyr-rspack-plugin
# yarn
yarn add --dev zephyr-rspack-plugin
# pnpm
pnpm add --dev zephyr-rspack-plugin
# bun
bun add --dev zephyr-rspack-plugin
```

## Usage

### With Nx and Rspack

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

### With Rspack directly

```
module.exports = withZephyr()(your_rspack_config);

```
