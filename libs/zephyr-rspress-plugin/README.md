# zephyr-rspress-plugin

<div align="center">

[Zephyr Cloud](https://zephyr-cloud.io) | [Zephyr Docs](https://docs.zephyr-cloud.io/recipes/rspress) | [Rspress Docs](https://rspress.dev/) | [Discord](https://zephyr-cloud.io/discord) | [Twitter](https://x.com/ZephyrCloudIO) | [LinkedIn](https://www.linkedin.com/company/zephyr-cloud/)

<hr/>
</div>

`zephyr-rspress-plugin` is a plugin to deploy application wrapped with [Rspress](https://rspress.dev/). Read more from our documentation [here](https://docs.zephyr-cloud.io/recipes/rspress).

## Installation

```
# npm
npm install --save-dev zephyr-rspress-plugin
# yarn
yarn add --dev zephyr-rspress-plugin
# pnpm
pnpm add --dev zephyr-rspress-plugin
# bun
bun add --dev zephyr-rspress-plugin
```

## Usage

### With Rspress

```
export default defineConfig({
  ...
  ssg: true,
  builderPlugins: [],
  plugins: [withZephyr()],
});
```
