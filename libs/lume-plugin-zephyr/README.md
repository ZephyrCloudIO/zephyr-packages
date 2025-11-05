# lume-plugin-zephyr

Lume plugin for deploying your static site to Zephyr Cloud.

## Installation

This plugin is designed for Deno environments only (like Lume). Add it to your import maps in `deno.json`:

```json
{
  "imports": {
    "lume-plugin-zephyr": "https://deno.land/x/lume_plugin_zephyr/mod.ts"
  }
}
```

Or import directly:

```typescript
import { withZephyr } from 'https://deno.land/x/lume_plugin_zephyr/mod.ts';
```

## Usage

Add the plugin to your `_config.ts`:

```typescript
import lume from 'lume/mod.ts';
import { withZephyr } from 'lume-plugin-zephyr';

const site = lume();

site.use(withZephyr());

export default site;
```

The plugin works automatically with no configuration required. It will detect your Lume site's output directory and upload all generated assets to Zephyr Cloud.

## How it works

The plugin integrates with Lume's build lifecycle:

1. **Before Build**: Initializes the Zephyr Engine with your project context
2. **After Build**: Collects all generated assets and uploads them to Zephyr Cloud

## Environment Variables

The plugin uses the Zephyr Agent, which requires the following environment variables:

- `ZEPHYR_TOKEN`: Your Zephyr Cloud authentication token
- `ZEPHYR_PROJECT_ID`: Your project ID (optional, can be auto-detected)
- `ZEPHYR_APPLICATION_ID`: Your application ID (optional, can be auto-detected)

## Example

See the [example](../../examples/lume) directory for a working example.

## Features

- Automatic deployment to Zephyr Cloud after each build
- Differential uploads (only changed files are uploaded)
- Build statistics and insights
- Version management

## License

Apache-2.0

## Contributing

Contributions are welcome! Please see the main [zephyr-packages](https://github.com/ZephyrCloudIO/zephyr-packages) repository for guidelines.
