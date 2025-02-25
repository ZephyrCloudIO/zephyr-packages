# Zephyr Plugins Migration Guide

This document provides guidance on migrating from previous versions of Zephyr plugins to the latest version with the unified architecture.

## Overview of Changes

Version 0.0.34 introduces a significant architectural change to all Zephyr bundler plugins. We've refactored the plugins to use a common base class (`ZeBasePlugin`) that provides shared functionality, resulting in:

- More consistent behavior across different bundlers
- Improved error handling and logging
- Better type safety
- Simplified maintenance and feature additions

## Plugin-Specific Migration Guides

### zephyr-webpack-plugin

**Old usage:**

```typescript
import { withZephyr } from 'zephyr-webpack-plugin';

// Previous usage with configuration object
const webpackConfig = {
  // webpack configuration
};

export default withZephyr(webpackConfig, {
  waitForIndexHtml: true,
});
```

**New usage:**

```typescript
import { withZephyr } from 'zephyr-webpack-plugin';

// New usage with options first, then configuration
const webpackConfig = {
  // webpack configuration
};

export default withZephyr({
  wait_for_index_html: true,
})(webpackConfig);
```

Key changes:

- The `withZephyr` function now returns a function that takes the webpack configuration, rather than taking the configuration directly.
- Option names have been standardized to use snake_case instead of camelCase.

### vite-plugin-zephyr

**Old usage:**

```typescript
import { withZephyr } from 'vite-plugin-zephyr';

// Previous vite config
export default {
  plugins: [
    withZephyr({
      waitForIndexHtml: true,
      mfOptions: {
        /* Module Federation options */
      },
    }),
  ],
};
```

**New usage:**

```typescript
import { withZephyr } from 'vite-plugin-zephyr';

// New vite config
export default {
  plugins: [
    withZephyr({
      wait_for_index_html: true,
      mfConfig: {
        /* Module Federation options */
      },
    }),
  ],
};
```

Key changes:

- Option names use snake_case consistently.
- `mfOptions` has been renamed to `mfConfig` for consistency across all plugins.

### rollup-plugin-zephyr

**Old usage:**

```typescript
import { withZephyr } from 'rollup-plugin-zephyr';

export default {
  plugins: [
    withZephyr({
      waitForIndexHtml: true,
    }),
  ],
};
```

**New usage:**

```typescript
import { withZephyr } from 'rollup-plugin-zephyr';

export default {
  plugins: [
    withZephyr({
      wait_for_index_html: true,
    }),
  ],
};
```

Key changes:

- Option names use snake_case consistently.
- The internal implementation now uses the common base class for better reliability.

### zephyr-rspack-plugin

**Old usage:**

```typescript
import { withZephyr } from 'zephyr-rspack-plugin';

const rspackConfig = {
  // rspack configuration
};

export default withZephyr(rspackConfig, {
  waitForIndexHtml: true,
});
```

**New usage:**

```typescript
import { withZephyr } from 'zephyr-rspack-plugin';

const rspackConfig = {
  // rspack configuration
};

export default withZephyr({
  wait_for_index_html: true,
})(rspackConfig);
```

Key changes:

- The `withZephyr` function now returns a function that takes the rspack configuration, similar to the webpack plugin.
- Option names use snake_case consistently.

### zephyr-rolldown-plugin

**Old usage:**

```typescript
import { withZephyr } from 'zephyr-rolldown-plugin';

export default {
  plugins: [
    withZephyr({
      waitForIndexHtml: true,
    }),
  ],
};
```

**New usage:**

```typescript
import { withZephyr } from 'zephyr-rolldown-plugin';

export default {
  plugins: [
    withZephyr({
      wait_for_index_html: true,
    }),
  ],
};
```

Key changes:

- Option names use snake_case consistently.
- The internal implementation now uses the common base class for better reliability.

### zephyr-repack-plugin

**Old usage:**

```typescript
import { withZephyr } from 'zephyr-repack-plugin';

// Previous usage
const repackConfig = {
  // repack configuration
};

export default withZephyr('ios', repackConfig, {
  waitForIndexHtml: true,
});
```

**New usage:**

```typescript
import { withZephyr } from 'zephyr-repack-plugin';

// New usage
const repackConfig = {
  // repack configuration
};

export default withZephyr('ios', {
  wait_for_index_html: true,
})(repackConfig);
```

Key changes:

- The `withZephyr` function now takes the target platform first, then options, and returns a function that takes the repack configuration.
- Option names use snake_case consistently.

## Common Changes Across All Plugins

### Option Name Standardization

All plugin options now use snake_case for consistency:

| Old Option Name    | New Option Name       |
| ------------------ | --------------------- |
| `waitForIndexHtml` | `wait_for_index_html` |
| `mfOptions`        | `mfConfig`            |

### Enhanced Error Handling

All plugins now provide better error handling with more detailed error messages. Errors during asset processing are now properly captured and reported.

### Logging Improvements

Logging has been standardized across all plugins with consistent formats:

```
[PluginName] Message
[PluginName] ERROR: Error message
[PluginName] WARNING: Warning message
```

## Module Federation Changes

Module Federation configuration has been standardized across all plugins. The `mfConfig` option is now consistently used to configure Module Federation in all supported bundlers.

## Additional Resources

- [Zephyr Plugins Architecture Documentation](https://docs.zephyr-cloud.io)
- [API Reference](https://docs.zephyr-cloud.io/api-reference)
- [Examples Repository](https://github.com/ZephyrCloudIO/zephyr-examples)

If you encounter any issues or have questions about the migration, please open an issue on our [GitHub repository](https://github.com/ZephyrCloudIO/zephyr-packages).
