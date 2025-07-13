# Weather Tools MCP Server - Webpack Example

This example demonstrates how to build an MCP server using Webpack and Module Federation.

## Features

- Weather information tools (current weather, forecast, location search)
- Built with Webpack instead of Rspack
- Module Federation for remote loading
- Automatic deployment to Zephyr Cloud

## Available Tools

1. **get_weather** - Get current weather for a location
2. **get_forecast** - Get weather forecast for up to 7 days
3. **search_location** - Search for location coordinates

## Building

```bash
# Install dependencies
npm install

# Build for production
npm run build

# Build in watch mode for development
npm run dev
```

## Testing Locally

After building, you can test the MCP server locally:

```bash
node dist/main.js
```

## Deployment

The Zephyr plugin automatically deploys your MCP server during the build process. After building, your server will be available at a Zephyr Cloud URL.

## Configuration

The webpack configuration includes:

- TypeScript support via ts-loader
- Module Federation for remote loading
- Node.js target for server-side execution
- Zephyr integration for automatic deployment

## Differences from Rspack Example

- Uses standard Webpack instead of Rspack
- Uses ts-loader for TypeScript compilation
- Configuration syntax is slightly different
- Module Federation plugin imported from webpack-specific package
