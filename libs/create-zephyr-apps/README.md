# Create Zephyr Apps

<div align="center">

[Zephyr Cloud](https://zephyr-cloud.io) | [Zephyr Docs](https://docs.zephyr-cloud.io) | [Discord](https://zephyr-cloud.io/discord) | [Twitter](https://x.com/ZephyrCloudIO) | [LinkedIn](https://www.linkedin.com/company/zephyr-cloud/)

<hr/>
<img src="https://cdn.prod.website-files.com/669061ee3adb95b628c3acda/66981c766e352fe1f57191e2_Opengraph-zephyr.png" alt="Zephyr Logo" />
</div>

A CLI tool to create web applications using Zephyr. This package provides templates and scaffolding for quickly setting up new projects with Zephyr integration.

## Installation

```bash
# npm (global)
npm install -g create-zephyr-apps

# npx (recommended)
npx create-zephyr-apps@latest

# yarn
yarn create zephyr-apps

# pnpm
pnpm create zephyr-apps

# bun
bunx create-zephyr-apps
```

## Usage

### Interactive Mode

Run the command without arguments in a TTY to choose the directory, project
type, template, and whether to initialize Git:

```bash
npx create-zephyr-apps@latest
```

```
┌  Bootstrap your project using Zephyr!
│
◇  Zephyr Cloud
│  The only sane way to do micro-frontends
│  https://docs.zephyr-cloud.io/
│
◇  Where should we create your project?
│  ./react-vite
│
◇  What type of project you are creating?
│  Web
│
◇  Pick a template:
│  React + Rspack
│
◇  Project successfully created at react-vite!
│
◇  Would you like to initialize a new Git repository?
│  Yes
│
◇  Run the application!
│  cd ./react-vite
│  pnpm install
│  pnpm run build
│
◇  Next steps.
│  - Discord
│  - Documentation
│  - Open an issue
└
```

### Non-interactive Mode

Pass a project directory to scaffold without prompts. Non-interactive runs use
the pinned `react-rsbuild` template by default and do not initialize Git,
install dependencies, or build unless those actions are explicitly requested.

The directory can be positional:

```bash
npx create-zephyr-apps@latest ./my-app --no-git
```

Or supplied with `--directory`:

```bash
npx create-zephyr-apps@latest --directory ./my-app --no-git
```

This complete example is also tested against the CLI parser:

```bash
create-zephyr-apps ./apps/example --template react-rsbuild --package-manager pnpm --no-git --install --build --json
```

`--build` implies `--install`. Install and build failures preserve the command's
non-zero exit code.

### Deterministic templates

Each published CLI version pins both template repositories to exact commits.
Use the release-compatible revision by default. To reproduce a different known
revision, pass its full 40-character commit SHA:

```bash
npx create-zephyr-apps@latest ./my-app \
  --template react-rsbuild \
  --template-revision 881c3a83d2f1888720c3da72e9b7a055aae1e3c7 \
  --no-git
```

List the template IDs and the pinned web-template revision with:

```bash
npx create-zephyr-apps@latest --list-templates
npx create-zephyr-apps@latest --list-templates --json
```

The CLI rejects unknown template IDs and refuses to write into a non-empty
directory.

### Package manager and Git behavior

Choose a package manager explicitly with `--package-manager pnpm`, `npm`,
`yarn`, or `bun`. Otherwise, the CLI checks the copied template's
`packageManager` field and lockfile, the invoking package-manager user agent,
the current project, and finally falls back to pnpm.

Git initialization and the initial commit only happen after an interactive
confirmation or when `--git` is passed. Use `--no-git` to record that choice
explicitly in scripts.

### JSON output

`--json` disables prompts and emits one JSON document. It includes:

- The resolved output directory, project type, template repository, and exact
  template commit.
- The selected package manager and its version when installation is requested.
- Created files, build artifacts, and resolved workspace/installed package
  versions.
- Every executed command with its stage, working directory, and exit code.
- Structured failures. Failed install and build runs still emit JSON before
  returning the underlying exit code.

### CLI options

```text
Usage: create-zephyr-apps [directory] [options]

--directory, -d <path>           Project directory (alternative to positional)
--template, -t <id>              Web template ID (default: react-rsbuild)
--project-type <type>            web or react-native (default: web)
--package-manager <manager>      pnpm, npm, yarn, or bun
--template-revision <commit>     Override the pinned template with a full SHA
--git / --no-git                 Enable or disable Git initialization
--install                        Install dependencies
--build                          Install dependencies and run the build script
--json                           Emit one machine-readable JSON result
--yes, -y                        Use deterministic defaults without prompting
--list-templates                 List available web template IDs
--version, -v                    Print the CLI version
--help, -h                       Show help
```

## Available Templates

### Bundlers

- **react-vite** - React app powered by Vite
- **react-rspack** - React application built with Rspack
- **parcel-react** - React application using Parcel
- **rolldown-react** - React example using Rolldown
- **rollup-react** - React application using Rollup
- **tsdown** - React component library starter with tsdown

### Module Federation

- **airbnb-clone** - Airbnb clone with React, TypeScript, and Module Federation
- **angular-rsbuild** - Angular application with Module Federation using Rsbuild
- **angular-vite-mf** - Angular application with Module Federation using Vite
- **react-rsbuild** - React application with Module Federation using Rsbuild
- **react-vite-rspack-webpack** - Federated React apps powered by Vite, Webpack, and Rspack
- **react-webpack** - React application with Module Federation using Webpack
- **tractor-sample** - Micro-frontend sample with Rspack and Module Federation

### Frameworks

- **angular-vite** - Angular app powered by Vite
- **astro** - Astro static site generator example
- **ember-vite** - Ember application using Vite
- **modernjs** - ModernJS app
- **rspress** - Rspress static site generator example
- **solid-vite** - Solid app using Vite
- **svelte-vite** - Svelte app using Vite
- **tanstack-start** - TanStack Start application with Vite

### Server

- **nitro-hono** - Hono running on Nitro server with Zephyr Cloud deployment
- **nitro-elysia** - Elysia running on Nitro server with Zephyr Cloud deployment
- **nitro-hello-world** - Minimal Nitro server with Zephyr Cloud deployment

### Build Systems

- **nx-rspack-mf** - Monorepo using NX, React, and Rspack with Module Federation
- **turborepo-rspack-mf** - Monorepo using Turborepo, React, and Rspack with Module Federation

## Features

- 🚀 Quick project scaffolding
- 📦 Multiple bundler support (Vite, Webpack, Rspack, Parcel)
- 🔧 Pre-configured Zephyr integration
- 🏗️ Module Federation ready templates
- 📱 React Native support with Re.Pack
- 🎯 TypeScript support out of the box
- 🌐 Server-side templates (Nitro)

## Contributing

We welcome contributions! Please read our [contributing guidelines](../../CONTRIBUTING.md) for more information.

## License

Licensed under the Apache-2.0 License. See [LICENSE](LICENSE) for more information.
