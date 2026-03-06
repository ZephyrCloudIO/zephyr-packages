# Zephyr Rspress Plugin

<div align="center">

[Zephyr Cloud](https://zephyr-cloud.io) | [Zephyr Docs](https://docs.zephyr-cloud.io/meta-frameworks/rspress) | [Rspress Docs](https://rspress.dev/) | [Discord](https://zephyr-cloud.io/discord) | [Twitter](https://x.com/ZephyrCloudIO) | [LinkedIn](https://www.linkedin.com/company/zephyr-cloud/)

<hr/>
<img src="https://cdn.prod.website-files.com/669061ee3adb95b628c3acda/66981c766e352fe1f57191e2_Opengraph-zephyr.png" alt="Zephyr Logo" />
</div>

An Rspress plugin for deploying documentation and static apps with Zephyr Cloud. This plugin enables seamless integration with Rspress to optimize, build, and deploy your site globally with CDN-backed delivery and analytics.

> Learn more in our [documentation](https://docs.zephyr-cloud.io/meta-frameworks/rspress).

---

## Get Started

You can quickly get started using the official Rspress template:

```bash
npx create-zephyr-apps@latest
```

Select the Rspress example when prompted.

For advanced usage and more recipes, visit our [documentation](https://docs.zephyr-cloud.io/meta-frameworks/rspress).

---

## Installation

```bash
# npm
npm install --save-dev zephyr-rspress-plugin

# yarn
yarn add --dev zephyr-rspress-plugin

# pnpm
pnpm add --save-dev zephyr-rspress-plugin

# bun
bun add --dev zephyr-rspress-plugin
```

---

## Usage

### With Rspress

Add the plugin to your \`rspress.config.ts\` or \`rspress.config.js\` file:

```ts
// rspress.config.ts
import { defineConfig } from 'rspress/config';
import { withZephyr } from 'zephyr-rspress-plugin';

export default defineConfig({
  ssg: true,
  plugins: [withZephyr()],
});
```

---

## Features

- 📘 Seamless Rspress integration
- 📦 Automatic static asset upload
- 🌍 Global CDN distribution
- 🔍 Optional search index support
- 🧠 Smart caching and invalidation
- 📊 Build analytics and logs via Zephyr Cloud
- 🛠️ Minimal config, works with \`rspress build\`

---

## Build Scripts

Add these scripts to your \`package.json\`:

```json
{
  "scripts": {
    "dev": "rspress dev",
    "build": "rspress build",
    "build:prod": "NODE_ENV=production rspress build"
  }
}
```

After running \`build\`, your site will automatically be uploaded to Zephyr Cloud if the plugin is enabled and configured.

---

## Requirements

- Rspress 0.7 or higher
- Node.js 18 or higher
- Zephyr Cloud account (sign up at [zephyr-cloud.io](https://zephyr-cloud.io))

---

## Examples

Explore our [examples directory](../../examples/) to see the plugin in action:

- [rspress-site](../../examples/rspress-site/) – A simple Rspress documentation site deployed via Zephyr

---

## Contributing

We welcome contributions! Please see our [contributing guidelines](../../CONTRIBUTING.md) before submitting pull requests.

---

## License

Licensed under the Apache-2.0 License. See [LICENSE](LICENSE) for more information.
