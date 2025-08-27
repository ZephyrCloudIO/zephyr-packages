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

This will prompt you to choose:

- Project name
- Template type (React, Vue, etc.)
- Build tool (Vite, Webpack, Rspack, etc.)
- Additional configurations

### Direct Usage

You can also specify options directly:

```bash
npx create-zephyr-apps@latest my-app --template vite-react-ts
```

## Available Templates

- **angular-vite** - Angular app with Vite
- **modernjs-app** - A simple ModernJS app
- **qwik-1.5** - A Qwik v1.5 app using Vite as the bundler
- **react-airbnb-clone** - Airbnb clone with React, TypeScript, and Module Federation
- **react-rspack-tractor-2.0** - React application using Rspack as the bundler and Tractor 2.0 as the module federation manager
- **react-vite-mf** - Federated React apps powered by Vite, Webpack and Rspack
- **rolldown-react** - A React example using Rolldown
- **rspack-project** - A simple application build by Rspack
- **solid** - A Solid app using Vite as the bundler
- **svelte** - A Svelte app using Vite as the bundler
- **turbo-rspack-mf** - A monorepo using Turborepo, React, and Rspack as the bundler
- **vite-react-ts** - A simple React application build by Vite

## Getting Started

After creating your application:

1. Navigate to your project directory:

   ```bash
   cd my-app
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the development server:

   ```bash
   npm run dev
   ```

4. Build for production:
   ```bash
   npm run build
   ```

## Features

- 🚀 Quick project scaffolding
- 📦 Multiple bundler support (Vite, Webpack, Rspack, Parcel)
- 🔧 Pre-configured Zephyr integration
- 🏗️ Module Federation ready templates
- 📱 React Native support with Re.Pack
- 🎯 TypeScript support out of the box

## Contributing

We welcome contributions! Please read our [contributing guidelines](../../CONTRIBUTING.md) for more information.

## License

Licensed under the Apache-2.0 License. See [LICENSE](LICENSE) for more information.
