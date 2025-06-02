# Zephyr Plugin Generator

A custom Nx generator for creating new Zephyr package libraries with standardized structure and configuration.

## Usage

Run the generator using Nx:

```bash
nx generate ./tools/zephyr-plugin-generator:zephyr-package [name] [options]
```

### Quick Examples

```bash
# Create a new webpack plugin
nx generate ./tools/zephyr-plugin-generator:zephyr-package my-plugin --bundler webpack

# Create a new vite plugin
nx generate ./tools/zephyr-plugin-generator:zephyr-package my-plugin --bundler vite --packageType plugin

# Create a new agent package
nx generate ./tools/zephyr-plugin-generator:zephyr-package my-agent --packageType agent

# Create an internal utility package
nx generate ./tools/zephyr-plugin-generator:zephyr-package my-util --packageType internal
```

## Options

### Required

- `name` - The name of the package (e.g., 'webpack-plugin', 'vite-plugin')
  - Must match pattern: `^[a-z][a-z0-9]*(-[a-z0-9]+)*$`

### Optional

- `--directory` - Directory where the package will be created (default: `libs`)
- `--packageType` - Type of Zephyr package to create
  - Options: `plugin`, `agent`, `internal`, `utility`
  - Default: `plugin`
- `--bundler` - Target bundler for plugin packages
  - Options: `webpack`, `vite`, `rollup`, `rspack`, `parcel`, `metro`, `modernjs`, `rolldown`, `rsbuild`
  - Default: `webpack`
  - Only used when `packageType` is `plugin`
- `--description` - Package description
- `--addTests` - Add test setup (default: `true`)

## Package Naming Convention

The generator automatically creates package names based on the type and bundler:

- **Plugin packages**: `zephyr-{bundler}-plugin` (e.g., `zephyr-webpack-plugin`)
- **Agent packages**: `zephyr-agent`
- **Internal packages**: `zephyr-{name}-internal`
- **Other packages**: `zephyr-{name}`

## Generated Structure

Each generated package includes:

```
libs/zephyr-{package-name}/
├── LICENSE
├── README.md
├── package.json
├── jest.config.ts          (if addTests: true)
├── tsconfig.json
├── tsconfig.lib.json
├── tsconfig.spec.json      (if addTests: true)
└── src/
    └── index.ts
```

## Project Configuration

The generator automatically adds Nx project configuration with targets for:

- `build` - TypeScript compilation using `@nx/js:tsc`
- `lint` - ESLint using `@nx/eslint:lint`
- `test` - Jest testing (if `addTests: true`)
- `release` - NPM release management

## Examples by Package Type

### Plugin Package

```bash
nx generate ./tools/zephyr-plugin-generator:zephyr-package my-plugin --bundler vite --packageType plugin
```

Creates: `libs/zephyr-vite-plugin/`

### Agent Package

```bash
nx generate ./tools/zephyr-plugin-generator:zephyr-package analytics --packageType agent
```

Creates: `libs/zephyr-agent/`

### Internal Package

```bash
nx generate ./tools/zephyr-plugin-generator:zephyr-package xpack --packageType internal
```

Creates: `libs/zephyr-xpack-internal/`

### Utility Package

```bash
nx generate ./tools/zephyr-plugin-generator:zephyr-package utils --packageType utility
```

Creates: `libs/zephyr-utils/`
