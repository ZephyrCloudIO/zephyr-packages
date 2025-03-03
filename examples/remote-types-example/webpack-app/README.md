# Remote Types Webpack Example

This example demonstrates the Remote Types Detection functionality in a Webpack application, showing how to automatically detect CSR and SSR configurations and integrate with Module Federation.

## Features

- Automatic detection of render type (CSR/SSR)
- Framework detection
- Manifest file generation
- Runtime access to remote types information
- Module Federation integration with render type metadata
- Support for both CSR and SSR builds

## Getting Started

```bash
# Install dependencies
npm install

# Run in CSR mode
npm run start

# Run in SSR mode
npm run start:ssr

# Build both CSR and SSR
npm run build && npm run build:ssr
```

## Implementation Details

This example uses the `webpackRemoteTypesPlugin` to detect and configure render types:

```javascript
// webpack.config.js
const { webpackRemoteTypesPlugin } = require('../../../remote-types-webpack-plugin');

module.exports = (env = {}) => {
  // Determine if SSR mode is enabled
  const isSSR = env.ssr === true;
  
  return {
    // ... webpack config
    plugins: [
      // ... other plugins
      webpackRemoteTypesPlugin({
        renderType: isSSR ? 'ssr' : undefined,
        outputManifest: true,
        manifestFilename: isSSR ? 'remote-types-ssr-manifest.json' : 'remote-types-manifest.json',
        logDetectionResults: true,
        updateModuleFederationConfig: true
      })
    ]
  };
};
```

## Module Federation Integration

The plugin automatically updates Module Federation configuration with render type information:

```javascript
new ModuleFederationPlugin({
  name: 'remoteTypesApp',
  filename: 'remoteEntry.js',
  exposes: {
    './RemoteComponent': './src/RemoteComponent.tsx'
  },
  // This is automatically added by the Remote Types plugin
  renderType: 'csr' // or 'ssr' depending on detection
})
```

## Using Remote Types in Your Code

The plugin exposes render type information through a global variable:

```typescript
// Access in your code
declare global {
  interface Window {
    __REMOTE_TYPES_DETECTION__: {
      renderType: string;
      framework: string;
    };
  }
}

// Use the render type
const renderType = window.__REMOTE_TYPES_DETECTION__.renderType;
```

## How It Works

1. The plugin analyzes your webpack configuration to detect the render type
2. It modifies the Module Federation plugin to include the render type
3. It creates a metadata manifest file with the detected information
4. It exposes the render type information through a global variable

## Generated Manifest

The plugin generates a `remote-types-manifest.json` file that contains:

```json
{
  "renderType": "csr",
  "framework": "cra",
  "moduleFederationVersion": "2.0.0"
}
```

This manifest can be used by remote resolution systems to ensure compatibility between federated modules.