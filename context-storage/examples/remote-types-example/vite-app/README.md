# Remote Types Vite Example

This example demonstrates the Remote Types Detection functionality in a Vite application, showing how to automatically detect CSR and SSR configurations.

## Features

- Automatic detection of render type (CSR/SSR)
- Framework detection
- Manifest file generation
- Runtime access to remote types information
- Support for both CSR and SSR builds

## Getting Started

```bash
# Install dependencies
npm install

# Run in CSR mode
npm run dev

# Run in SSR mode
npm run dev:ssr

# Build both CSR and SSR
npm run build && npm run build:ssr
```

## Implementation Details

This example uses the `viteRemoteTypesPlugin` to detect and configure render types:

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteRemoteTypesPlugin } from '../../../remote-types-vite-plugin';

export default defineConfig({
  plugins: [
    react(),
    viteRemoteTypesPlugin({
      enabled: true,
      logDetectionResults: true,
      outputManifest: true
    })
  ]
});
```

For the SSR configuration, we explicitly set the render type:

```typescript
// vite.config.ssr.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteRemoteTypesPlugin } from '../../../remote-types-vite-plugin';

export default defineConfig({
  plugins: [
    react(),
    viteRemoteTypesPlugin({
      enabled: true,
      renderType: 'ssr', // Explicitly set to SSR
      logDetectionResults: true,
      outputManifest: true,
      manifestFilename: 'remote-types-ssr-manifest.json'
    })
  ],
  build: {
    ssr: true, // Enable SSR build
    outDir: 'dist-ssr'
  }
});
```

## Using Remote Types in Your Code

The plugin provides a virtual module for accessing the render type information in your code:

```typescript
import remoteTypes from 'virtual:remote-types';

// Use the render type information
if (remoteTypes.renderType === 'ssr') {
  // SSR-specific code
} else {
  // CSR-specific code
}
```

## How It Works

1. The plugin analyzes your dependencies and configuration to detect the render type
2. It creates a metadata manifest file with the detected information
3. It exposes the render type information through a virtual module
4. It can suggest or apply configuration based on the detected render type

## Generated Manifest

The plugin generates a `remote-types-manifest.json` file that contains:

```json
{
  "renderType": "csr",
  "framework": "vite-react",
  "frameworkVersion": "^4.2.0"
}
```

This manifest can be consumed by other tools or modules to understand the rendering approach of your application.