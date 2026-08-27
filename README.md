# Zephyr Plugins

<div align="center">

[Zephyr Cloud](https://zephyr-cloud.io) | [Zephyr Docs](https://docs.zephyr-cloud.io) | [Discord](https://zephyr-cloud.io/discord) | [Twitter](https://x.com/ZephyrCloudIO) | [LinkedIn](https://www.linkedin.com/company/zephyr-cloud/)

<hr/>
  <img src="https://cdn.prod.website-files.com/669061ee3adb95b628c3acda/66981c766e352fe1f57191e2_Opengraph-zephyr.png" alt="Zephyr Logo" />
</div>

![Alt](https://repobeats.axiom.co/api/embed/17e3197a58591981edf92b19c4078320b6decc0a.svg 'Repobeats analytics image')

## Contributing

We welcome contributions! Please read our [contributing guidelines](CONTRIBUTING.md) for more information.

## Plugins

Plugins within this repository are built for applications to deploy with Zephyr. This repository also includes utility packages for building npm plugins with Zephyr.

### Public Plugins

- [`create-zephyr-apps`](libs/create-zephyr-apps/README.md) - Create new applications with Zephyr integration
- [`parcel-reporter-zephyr`](libs/parcel-reporter-zephyr/README.md) - A Parcel reporter plugin for deploying with Zephyr
- [`rollup-plugin-zephyr`](libs/rollup-plugin-zephyr/README.md) - A Rollup plugin for deploying with Zephyr
- [`vite-plugin-zephyr`](libs/vite-plugin-zephyr/README.md) - A Vite plugin for deploying with Zephyr
- [`zephyr-nuxt-module`](libs/zephyr-nuxt-module/README.md) - A Nuxt module for deploying with Zephyr
- [`vite-plugin-vinext-zephyr`](libs/vite-plugin-vinext-zephyr/README.md) - A Vite plugin for deploying Vinext apps with Zephyr
- [`zephyr-modernjs-plugin`](libs/zephyr-modernjs-plugin/README.md) - A Modern.js plugin for deploying with Zephyr
- [`zephyr-repack-plugin`](libs/zephyr-repack-plugin/README.md) - A Rspack plugin for deploying with Zephyr building with React Native and Re.Pack
- [`zephyr-rolldown-plugin`](libs/zephyr-rolldown-plugin/README.md) - A Rolldown plugin for deploying with Zephyr
- [`zephyr-rspack-plugin`](libs/zephyr-rspack-plugin/README.md) - A Rspack plugin for deploying with Zephyr
- [`zephyr-tap-runtime`](libs/zephyr-tap-runtime/README.md) - A host-owned TAP lifecycle runtime plugin for Module Federation
- [`zephyr-webpack-plugin`](libs/zephyr-webpack-plugin/README.md) - A Webpack plugin for deploying with Zephyr

### Utility Packages

- `zephyr-agent` - The main internal package to build bundler integration with Zephyr. Public plugins mostly interact with this package.
- `zephyr-xpack-internal` - Sharing types, module federation capabilities and utilities for bundler built on top of webpack or Rspack.
- `zephyr-edge-contract` - Provide typings, constants and smaller utilites for Zephyr plugins.

## Repository Structure

This is a [Turborepo](https://turborepo.com) monorepo. Libraries are built with
[Rslib](https://lib.rsbuild.dev), tests run with [Rstest](https://rstest.rs), and
repository linting and formatting use Oxlint and Oxfmt.

- `libs` - Contains all the plugins and utility packages.
- `examples` - Contains examples to use and test the plugins.

## Using this repository

```bash
pnpm install
```

For the opaque `tap-app` build-target contract, see
[the target documentation](docs/tap-app-publication.md).

## Available Scripts

### Development

- `pnpm build` - Builds every package under `libs`
- `pnpm build-all` - Builds all packages and examples in dependency order
- `pnpm typecheck` - Type-checks the TypeScript project-reference graph

### Testing

- `pnpm test` - Runs the test suite
- `pnpm test:affected` - Runs tests affected by the current branch
- `pnpm test:coverage` - Runs the repository-wide Rstest coverage suite
- `pnpm test:examples` - Runs example unit tests and the production deployment E2E suite

PR CI builds and deploys affected examples by default. Apply the
`ci:force-example-builds` label to build and deploy every example with a build
script and refresh the Zephyr preview links. Remove the label to return future
PR updates to affected-only builds.

### Linting & Formatting

- `pnpm lint` - Checks code for linting errors
- `pnpm format:check` - Checks formatting with Oxfmt
- `pnpm format` - Formats code with Oxfmt

### Version Management

- Stable releases are prepared by Release Please from Conventional Commits on
  `main`.
- Merge the generated release PR to update every package and plugin manifest,
  create the `vX.Y.Z` tag and GitHub Release, and publish packages to npm.
- Manual `pnpm bump-*` scripts and hand-created stable tags are retired.

See [Release automation](docs/releasing.md) for the complete release policy.

Note: Please ensure you have run `pnpm install` before executing any of these commands.
