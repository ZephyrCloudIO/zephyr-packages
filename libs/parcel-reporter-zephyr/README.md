# Zephyr Parcel Plugin

## Usage

### With .parcelrc (Recommended)

The easiest way to use the Zephyr Parcel plugin is to add it to your `.parcelrc` file:

```json
//.parcelrc
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
