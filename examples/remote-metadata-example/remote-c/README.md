# Remote C - Webpack Application

This is a Webpack remote application built with React, demonstrating the Remote Entry Structure Sharing functionality from the Zephyr Module Federation project.

## Features

- **Webpack + Module Federation**: Uses Webpack with Module Federation plugin
- **Metadata Publishing**: Automatically generates metadata about the component for consumption
- **React Card Component**: Exposes a reusable card component for federation
- **Enhanced Module Federation**: Uses '@module-federation/enhanced' for additional features

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The application will be available at http://localhost:3003.

## Implementation Details

### Module Federation Configuration

The application uses `ModuleFederationPlugin` from `@module-federation/enhanced` to expose the Card component:

```javascript
new ModuleFederationPlugin({
  name: 'remoteC',
  filename: 'remoteEntry.js',
  exposes: {
    './Card': './src/components/Card.tsx'
  },
  shared: {
    react: { singleton: true, requiredVersion: '^18.2.0' },
    'react-dom': { singleton: true, requiredVersion: '^18.2.0' }
  }
})
```

### Metadata Publishing

The application utilizes the `RemoteStructureSharingIntegration` from the Zephyr project to automatically extract and publish metadata:

```javascript
// Add Metadata Publishing
const packageJson = require('./package.json');
module.exports = RemoteStructureSharingIntegration.setupBundlerPlugin(
  webpackConfig,
  packageJson
);
```

This integration automatically:
1. Extracts metadata from package.json and webpack configuration
2. Determines framework, rendering type, and dependencies
3. Creates a metadata file alongside the remoteEntry.js file
4. Ensures compatibility with consuming applications

## Integration with Host

The Card component can be consumed by the host application, which will validate compatibility based on the published metadata.