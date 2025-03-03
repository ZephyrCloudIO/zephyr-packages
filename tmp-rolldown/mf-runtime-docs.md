# Module Federation Runtime

## Overview
Module Federation Runtime is an implementation of the Module Federation spec that runs at runtime rather than build time. It allows applications to dynamically share and consume federated modules without having to rebuild the entire application.

## Core Concepts

### Host and Remote
- **Host**: The application that consumes federated modules
- **Remote**: The application that exposes modules for consumption

### Runtime Loading
- Modules are loaded asynchronously at runtime
- Uses dynamic imports and promises to fetch remote modules
- Provides automatic versioning and dependency resolution

### Shared Dependencies
- Multiple applications can share common dependencies
- Singletons ensure only one instance of a dependency runs
- Version matching ensures compatibility

## Key Features

- **Cross-bundler compatibility**: Works with Webpack, Rollup, ESBuild, Rolldown, etc.
- **Hot Module Replacement (HMR)**: Updates modules without page reloads
- **Lazy Loading**: Loads modules only when needed
- **Version control**: Ensures compatible versions are loaded
- **Fallback support**: Graceful handling when remotes fail to load

## Configuration

### Basic Configuration (Host)
```js
const { defineConfig } = require('rolldown');
const { moduleFederationPlugin } = require('rolldown/experimental');

module.exports = defineConfig({
  plugins: [
    moduleFederationPlugin({
      name: 'host',
      remotes: {
        app1: 'http://localhost:3001/remoteEntry.js',
        app2: 'http://localhost:3002/remoteEntry.js'
      },
      shared: {
        react: { singleton: true },
        'react-dom': { singleton: true }
      }
    })
  ]
});
```

### Remote Configuration
```js
const { defineConfig } = require('rolldown');
const { moduleFederationPlugin } = require('rolldown/experimental');

module.exports = defineConfig({
  plugins: [
    moduleFederationPlugin({
      name: 'app1',
      filename: 'remoteEntry.js',
      exposes: {
        './Button': './src/Button',
        './Footer': './src/Footer'
      },
      shared: {
        react: { singleton: true },
        'react-dom': { singleton: true }
      }
    })
  ]
});
```

## Using Federated Modules

### Dynamic Import
```js
// Using dynamic import with Module Federation
const Button = React.lazy(() => import('app1/Button'));

function App() {
  return (
    <React.Suspense fallback="Loading Button...">
      <Button />
    </React.Suspense>
  );
}
```

### Error Handling
```js
// With error handling
const RemoteButton = React.lazy(() => 
  import('app1/Button').catch(err => {
    console.error('Failed to load Button from app1', err);
    return { default: () => <div>Failed to load remote component</div> };
  })
);
```

## Runtime API

The runtime includes several key APIs:

- `init()`: Initializes the federation container
- `get()`: Retrieves a federated module
- `share()`: Registers a shared dependency
- `findShareForRequire()`: Locates a shared dependency

## Advanced Features

### Runtime Plugins
```js
// Adding runtime plugins
moduleFederationPlugin({
  // ...other config
  runtimePlugins: [
    './src/plugins/metrics.js',
    './src/plugins/logging.js'
  ]
})
```

### Container API
```js
// Accessing the container directly
const container = window.mfContainer;
const module = await container.get('./Button');
```

### Hot Reloading
Runtime supports hot reloading of federated modules, allowing for real-time updates without reloading the entire application.

## Implementation Details

Under the hood, the Module Federation runtime:

1. Creates a federation container to manage modules
2. Establishes a shared scope for dependencies
3. Loads remote entry points asynchronously
4. Resolves version conflicts for shared dependencies
5. Manages module lifecycles (init, load, error states)
6. Provides compatibility layers between different module systems

The runtime is designed to be lightweight and only loads what's needed when it's needed, improving initial load performance while enabling dynamic extensibility.