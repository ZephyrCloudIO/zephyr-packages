# Zephyr MCP Plugin

A Zephyr plugin that automatically bundles and deploys MCP (Model Context Protocol) servers to Zephyr Cloud using Rspack and Module Federation.

## Features

- 📦 **Automatic Bundling**: Bundles your MCP server with Module Federation
- ☁️ **Automatic Deployment**: Deploys to Zephyr Cloud during build
- 🌐 **Dynamic Loading**: Your server is dynamically loaded by Zephyr Host
- 🔄 **Version Management**: Automatic versioning through Module Federation
- 🛠️ **Simple Integration**: Just add `withZephyr()` to your Rspack config
- 🔒 **Secure Distribution**: Zephyr handles authentication and sandboxing

## Installation

```bash
npm install zephyr-mcp-plugin
# or
yarn add zephyr-mcp-plugin
# or
pnpm add zephyr-mcp-plugin
```

## Quick Start

### 1. Create Your MCP Server

```typescript
// src/my-tools.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';

export async function createMyToolsServer(): Promise<Server> {
  const server = new Server({
    name: 'my-tools',
    version: '1.0.0',
  });

  server.setRequestHandler('tools/list', async () => {
    return {
      tools: [
        {
          name: 'my_awesome_tool',
          description: 'Does something awesome',
          inputSchema: {
            type: 'object',
            properties: {
              input: { type: 'string' },
            },
            required: ['input'],
          },
        },
      ],
    };
  });

  server.setRequestHandler('tools/call', async (request) => {
    if (request.params.name === 'my_awesome_tool') {
      return {
        content: [
          {
            type: 'text',
            text: `Processed: ${request.params.arguments.input}`,
          },
        ],
      };
    }
    throw new Error('Tool not found');
  });

  return server;
}

export default createMyToolsServer;
```

### 2. Configure Rspack with Zephyr

```javascript
// rspack.config.js
import { defineConfig } from '@rspack/cli';
import { withZephyr } from 'zephyr-mcp-plugin';

const config = defineConfig({
  mode: 'production',
  target: 'async-node',
  entry: './src/index.ts',
  output: {
    path: './dist',
    clean: true,
  },
  // ... other Rspack config
});

// Apply Zephyr plugin for automatic deployment
export default withZephyr({
  // Module Federation configuration
  mfConfig: {
    name: 'my_tools_mcp',
    filename: 'remoteEntry.js',
    exposes: {
      './tools': './src/my-tools.ts',
    },
  },
  // Metadata for Zephyr
  metadata: {
    description: 'My awesome MCP tools',
    author: 'Your Name',
    homepage: 'https://github.com/yourname/my-tools',
    capabilities: {
      tools: ['my_awesome_tool'],
    },
  },
})(config);
```

### 3. Build and Deploy

```bash
# Build and automatically deploy to Zephyr Cloud
npm run build

# Output:
# ✓ Bundle created
# ✓ Deploying to Zephyr Cloud...
# ✓ MCP server deployed successfully!
#   Server: my_tools_mcp
#   Environment: production
```

### 4. Your Server is Live!

Your MCP server is now deployed to Zephyr Cloud and will be automatically available through the Zephyr Host MCP Server. Users can access your tool as `my-tools.my_awesome_tool`.

## Configuration Options

```typescript
interface ZephyrMCPPluginOptions {
  // Module Federation configuration
  mfConfig?: ModuleFederationPluginOptions;

  // Server metadata
  metadata?: {
    description?: string;
    author?: string;
    homepage?: string;
    documentation?: string;
    capabilities?: {
      tools?: string[];
      resources?: string[];
      prompts?: string[];
    };
    // Any additional metadata
    [key: string]: any;
  };

  // Set to false for non-MCP builds (default: false)
  wait_for_index_html?: boolean;
}
```

## How It Works

1. **Development**: You create an MCP server with tools, resources, or prompts
2. **Bundling**: Rspack bundles your server with Module Federation support
3. **Deployment**: The plugin automatically deploys to Zephyr Cloud during build
4. **Hosting**: Zephyr Cloud stores and serves your MCP bundle
5. **Distribution**: The Zephyr Host MCP Server loads your server dynamically
6. **Usage**: End users access your tools through the unified Zephyr MCP interface

## Examples

See the `examples/upload-to-zephyr/` directory for a complete example of a GitHub tools MCP server.

## Using Your Deployed Server

Once deployed, your MCP server can be accessed through the Zephyr Host MCP Server:

```bash
# Install the Zephyr MCP Server
npm install -g zephyr-mcp-server

# Start the host server (requires Zephyr API key)
ZEPHYR_API_KEY=your-key zephyr-mcp-server start

# Your tools are now available!
```

## Best Practices

1. **Unique Naming**: Choose a unique name for your Module Federation config
2. **Clear Descriptions**: Write clear tool descriptions and input schemas
3. **Error Handling**: Implement proper error handling in your tools
4. **Testing**: Test your server locally before deploying
5. **Versioning**: Update the version in your Module Federation config for updates

## License

MIT
