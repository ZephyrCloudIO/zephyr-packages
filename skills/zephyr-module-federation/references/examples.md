# Examples

Use this file when the user wants concrete working MF examples to copy from.

## Best examples

- Webpack host/remote: `https://github.com/ZephyrCloudIO/zephyr-examples/tree/main/module-federation/react-webpack`
- Rsbuild consumer/provider: `https://github.com/ZephyrCloudIO/zephyr-examples/tree/main/module-federation/react-rsbuild`
- Cross-bundler host + remotes: `https://github.com/ZephyrCloudIO/zephyr-examples/tree/main/module-federation/react-vite-rspack-webpack`
- Advanced staged builds: `https://github.com/ZephyrCloudIO/zephyr-examples/tree/main/module-federation/tractor-sample`
- Turborepo monorepo MF: `https://github.com/ZephyrCloudIO/zephyr-examples/tree/main/build-systems/turborepo-rspack-mf`

## Strong snippets

### Cross-bundler Vite host

File: `https://github.com/ZephyrCloudIO/zephyr-examples/blob/main/module-federation/react-vite-rspack-webpack/host/vite.config.ts`

- Good for showing remote `type: 'module'` vs `type: 'var'`
- Good for showing `withZephyr({ mfConfig })`

### Host dependency mapping

File: `https://github.com/ZephyrCloudIO/zephyr-examples/blob/main/module-federation/react-vite-rspack-webpack/host/package.json`

- Good for `workspace:*` mapping

### Turborepo build-order explanation

File: `https://github.com/ZephyrCloudIO/zephyr-examples/blob/main/build-systems/turborepo-rspack-mf/README.md`

- Good for explaining why remotes should build before host
- Good for monorepo orchestration answers
