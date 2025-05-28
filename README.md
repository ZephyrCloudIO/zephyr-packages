# Zephyr Plugins

<div align="center">

[Zephyr Cloud](https://zephyr-cloud.io) | [Zephyr Docs](https://docs.zephyr-cloud.io) | [Discord](https://zephyr-cloud.io/discord) | [Twitter](https://x.com/ZephyrCloudIO) | [LinkedIn](https://www.linkedin.com/company/zephyr-cloud/)

<hr/>
  <img src="https://cdn.prod.website-files.com/669061ee3adb95b628c3acda/66981c766e352fe1f57191e2_Opengraph-zephyr.png" alt="Zephyr Logo" />
</div>

## Contributing

We welcome contributions! Please read our [contributing guidelines](CONTRIBUTING.md) for more information.

## Plugins

Plugins within this repository are built for applications to deploy with Zephyr. This repository also includes utility packages for building npm plugins with Zephyr.

### Public Plugins

- [`zephyr-repack-plugin`](libs/zephyr-repack-plugin/README.md) - A Rspack plugin for deploying with Zephyr building with React Native and Re.Pack
- [`zephyr-rspack-plugin`](libs/zephyr-rspack-plugin/README.md) - A Rspack plugin for deploying with Zephyr
- [`vite-plugin-zephyr`](libs/vite-plugin-zephyr/README.md) - A Vite plugin for deploying with Zephyr.
- [`zephyr-webpack-plugin`](libs/zephyr-webpack-plugin/README.md) - A webpack plugin for Zephyr
- [`rollup-plugin-zephyr`](libs/rollup-plugin-zephyr/README.md) - A rollup plugin for Zephyr

### Utility Packages

- `zephyr-agent` - The main internal package to build bundler integration with Zephyr. Public plugins mostly interact with this package.
- `zephyr-xpack-internal` - Sharing types, module federation capabilities and utilities for bundler built on top of webpack or Rspack.
- `zephyr-edge-contract` - Provide typings, constants and smaller utilites for Zephyr plugins.

## Repository Structure

This is an [Nx](https://nx.dev) monorepo.

- `libs` - Contains all the plugins and utility packages.
- `examples` - Contains examples to use and test the plugins.

## Using this repository

```
pnpm install
```

## Available Scripts

### Development

- `pnpm dev` - Starts the development server
- `pnpm build` - Builds the application for production
- `pnpm start` - Runs the production build

### Testing

- `pnpm test` - Runs the test suite
- `pnpm test:watch` - Runs tests in watch mode

### Linting & Formatting

- `pnpm lint` - Checks code for linting errors
- `pnpm format` - Formats code using Prettier

### Version Management

- `pnpm bump-patch` - Automated patch version bump across all packages

  This script automates the complete patch version release process:

  - Increments patch version in root and all lib package.json files
  - Creates a commit with conventional commit message
  - Creates a git tag (vX.X.X)
  - If on main/master branch, creates a new feature branch and opens a PR
  - Pushes changes and tags to origin

  **Requirements:**

  - Clean working directory (no uncommitted changes)
  - gh CLI installed and authenticated (for automatic PR creation)
  - Git configured with push access to origin

Note: Please ensure you have run `pnpm install` before executing any of these commands.
