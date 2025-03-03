# Remote B - Vite CSR Application

This is a Client-Side Rendered (CSR) remote application built with Vite and React, demonstrating the Remote Entry Structure Sharing functionality from the Zephyr Module Federation project.

## Features

- **Client-Side Rendering**: This application is purely CSR, showcasing compatibility with SSR hosts
- **Vite + Module Federation**: Uses Vite with the Module Federation plugin
- **Metadata Publishing**: Automatically generates metadata about the component for consumption
- **React Button Component**: Exposes a reusable button component for federation

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The application will be available at http://localhost:3002.

## Implementation Details

### Module Federation Configuration

The application uses `@originjs/vite-plugin-federation` to expose the Button component:

```typescript
federation({
  name: 'remoteB',
  filename: 'remoteEntry.js',
  exposes: {
    './Button': './src/components/Button.tsx'
  },
  shared: {
    react: { singleton: true, requiredVersion: '^18.2.0' },
    'react-dom': { singleton: true, requiredVersion: '^18.2.0' }
  }
})
```

### Metadata Publishing

The application implements a custom Vite plugin that generates a metadata file alongside the remote entry:

```typescript
{
  name: 'metadata-publisher',
  closeBundle: () => {
    // Generate metadata file with CSR rendering type
    const metadata = {
      schemaVersion: '1.0.0',
      moduleFederationVersion: '2.0.0',
      renderType: 'csr',
      framework: 'vite',
      // ...additional metadata
    };
    
    // Write metadata file alongside remoteEntry.js
    // ...
  }
}
```

## Integration with Host

When consumed by the host application, this remote explicitly declares itself as a CSR component, allowing the host to make appropriate decisions about its rendering strategy.