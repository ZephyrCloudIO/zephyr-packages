# Advanced Features Demo

This example demonstrates the advanced features of Zephyr's Module Federation integration:

1. **Semantic Versioning Support** - Load specific versions of remote modules based on semver requirements
2. **Fallback Mechanisms** - Automatically retry with alternative URLs if a remote fails to load
3. **Server-Side Rendering** - Support for rendering federated components on the server

**Note about SSR**: While the SSR implementation provides a functional foundation, comprehensive SSR examples and specialized testing infrastructure will be developed in a future phase (Phase 4). The current implementation demonstrates the core SSR capabilities but is not yet recommended for production use without additional testing.

## Getting Started

```bash
# Install dependencies
npm install

# Run the demo
npm start
```

## Feature Examples

### Semantic Versioning

This example demonstrates loading a remote with a specific version requirement:

```js
// Host application
{
  remotes: {
    app1: {
      remote: 'app1',
      version: '^1.0.0',  // Accept any 1.x.x version
      options: {
        preferHighest: true  // Use the highest compatible version
      }
    }
  }
}
```

The Zephyr system will:
1. Find available versions of `app1`
2. Determine which versions satisfy `^1.0.0`
3. Use the highest compatible version
4. Generate appropriate runtime code for version compatibility checks

### Fallback Mechanisms

This example shows how to configure fallbacks for a remote:

```js
// Host application
{
  remotes: {
    app1: {
      remote: 'app1',
      version: '2.0.0',
      fallbacks: [
        'https://cdn1.example.com/app1/2.0.0/remoteEntry.js',
        'https://cdn2.example.com/app1/2.0.0/remoteEntry.js'
      ]
    }
  }
}
```

The Zephyr system will:
1. Try to load from the primary URL
2. If that fails, try each fallback URL in order
3. Implement exponential backoff between retries
4. Use circuit breaker pattern to prevent cascading failures

### Server-Side Rendering

This example demonstrates SSR support for Module Federation:

```js
// Server-side code
import { createSSRRemote } from 'zephyr-ssr';

const remote = await createSSRRemote('app1', {
  ssrEnabled: true,
  preload: true
});

const Component = await remote.get('./Component');
const html = renderToString(<Component />);

// Client-side hydration
const ssrData = {
  app1: {
    './Component': { /* state data */ }
  }
};

// Inject into the page
window.__ZEPHYR_SSR_STORE = ssrData;
```

## Configuration Options

See the code examples for complete configuration options for each feature.

## Integration with Test Matrix

This example is included in the Zephyr testing matrix and is automatically tested in CI/CD pipelines.