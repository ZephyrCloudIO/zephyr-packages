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

Run the command without arguments to start the interactive mode:

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
