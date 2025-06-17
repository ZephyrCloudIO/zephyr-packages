# Rolldown React Module Federation Example

This example demonstrates how to use Module Federation with Rolldown bundler, inspired by the Vite React Module Federation setup.

## Structure

- `host/` - The host application that consumes remote modules
- `remote/` - The remote application that exposes components

## Features

- **Host Application**: Consumes remote components using lazy loading
- **Remote Application**: Exposes a Button component for federation
- **Shared Dependencies**: React and React-DOM are shared as singletons
- **Rolldown Configuration**: Uses `rolldown.config.mjs` for both apps

## Usage

### Development

1. Start the remote application:
   ```bash
   cd remote
   npm run dev
   ```
   This will serve the remote on `http://localhost:3001`

2. Start the host application:
   ```bash
   cd host
   npm run dev
   ```
   This will serve the host on `http://localhost:3000`

### Production Build

```bash
# Build remote first
cd remote
npm run build

# Then build host
cd host
npm run build
```

## Configuration

The module federation is configured using the `zephyr-rolldown-plugin` with the following setup:

### Host Configuration
- Consumes remote components from `http://localhost:3001/remoteEntry.js`
- Shares React and React-DOM as singletons

### Remote Configuration  
- Exposes `./Button` component from `./src/Button`
- Shares React and React-DOM as singletons

## Testing Module Federation

1. The host application will lazy load the Button component from the remote
2. The Button component maintains its own state (counter)
3. Both applications share the same React instances to avoid conflicts