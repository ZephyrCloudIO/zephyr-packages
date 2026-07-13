# Parcel Reporter Zephyr

<div align="center">

[Zephyr Cloud](https://zephyr-cloud.io) | [Zephyr Docs](https://docs.zephyr-cloud.io) | [Discord](https://zephyr-cloud.io/discord) | [Twitter](https://x.com/ZephyrCloudIO) | [LinkedIn](https://www.linkedin.com/company/zephyr-cloud/)

<hr/>
<img src="https://cdn.prod.website-files.com/669061ee3adb95b628c3acda/66981c766e352fe1f57191e2_Opengraph-zephyr.png" alt="Zephyr Logo" />
</div>

A Parcel reporter plugin for deploying applications with Zephyr Cloud. This plugin automatically handles the deployment process during your Parcel build.

## Installation

```bash
# npm
npm install --save-dev parcel-reporter-zephyr

# yarn
yarn add --dev parcel-reporter-zephyr

# pnpm
pnpm add --dev parcel-reporter-zephyr

# bun
bun add --dev parcel-reporter-zephyr
```

## Usage

### With .parcelrc (Recommended)

The easiest way to use the Zephyr Parcel plugin is to add it to your `.parcelrc` file:

```json
// .parcelrc
{
  "extends": "@parcel/config-default",
  "reporters": ["...", "parcel-reporter-zephyr"]
}
```

### Programmatic Usage

If you're using Parcel programmatically, you can add the plugin directly:

```javascript
// build.js
const { Parcel } = require('@parcel/core');
const ZephyrReporter = require('parcel-reporter-zephyr');

async function build() {
  const bundler = new Parcel({
    entries: ['src/index.html'],
    defaultConfig: '@parcel/config-default',
    reporters: ['...', ZephyrReporter],
  });

  await bundler.run();
}

build();
```

## Configuration

The plugin works out of the box with minimal configuration. It will automatically:

- Collect build assets and metadata
- Upload to Zephyr Cloud during the build process
- Enable deployment capabilities for your application

### TAP package target

For a TAP package, use the programmatic reporter factory and select the `tap-app`
artifact family:

```js
const { createZephyrReporter } = require('parcel-reporter-zephyr');

const reporter = createZephyrReporter({
  target: 'tap-app',
  mfConfigs: [
    { name: 'desktop', filename: 'targets/desktop/remoteEntry.mjs' },
    { name: 'quickjs', filename: 'targets/quickjs/remoteEntry.mjs' },
  ],
  federation: [
    { name: 'desktop', remote: 'targets/desktop/remoteEntry.mjs', library_type: 'module' },
    { name: 'quickjs', remote: 'targets/quickjs/remoteEntry.mjs', library_type: 'module' },
  ],
});
```

Both arrays must be non-empty, have the same containers, and pair each `name` with
`filename === remote`. The reporter rejects incomplete or mismatched TAP metadata. A
single valid container also supplies the legacy `mfConfig`; multi-container builds
retain only the full arrays rather than choosing an arbitrary container.

## Features

- 🚀 Automatic deployment during build
- 📦 Asset optimization and caching
- 🔧 Zero-config setup
- 📊 Build analytics and monitoring
- 🌐 Global CDN distribution

## Getting Started

1. Install the plugin in your Parcel project
2. Add it to your `.parcelrc` configuration
3. Build your application as usual with `parcel build`
4. Your app will be automatically deployed to Zephyr Cloud

## Requirements

- Parcel 2.x or higher
- Node.js 14 or higher
- Zephyr Cloud account (sign up at [zephyr-cloud.io](https://zephyr-cloud.io))

## Contributing

We welcome contributions! Please read our [contributing guidelines](../../CONTRIBUTING.md) for more information.

## License

Licensed under the Apache-2.0 License. See [LICENSE](LICENSE) for more information.
