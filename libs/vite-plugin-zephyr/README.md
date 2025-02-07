# vite-plugin-zephyr

<div align="center">

[Zephyr Cloud](https://zephyr-cloud.io) | [Zephyr Docs](https://docs.zephyr-cloud.io/recipes/rspack-react) | [Rspack Docs](https://rspack.dev) | [Discord](https://zephyr-cloud.io/discord) | [Twitter](https://x.com/ZephyrCloudIO) | [LinkedIn](https://www.linkedin.com/company/zephyr-cloud/)

<hr/>
</div>

`vite-plugin-zephyr` is a plugin to deploy application built with [Vite](https://vitejs.dev). Read more from our documentation [here](https://docs.zephyr-cloud.io/recipes/react-vite). We use the official [vite plugin from Module Federation](https://github.com/module-federation/vite) under the hood.

## Installation

```
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

Using `vite-plugin-zephyr` adding it to the plugins array:

```js
import { withZephyr, type ModuleFederationOptions } from 'vite-plugin-zephyr';

export default defineConfig({
  plugins: [react(), withZephyr({ mfConfig })],
  build: {
    target: 'chrome89',
  },
});
export default config;
```
