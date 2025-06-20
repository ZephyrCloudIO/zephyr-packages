# Zephyr MCP Server

A host server that dynamically loads and runs MCP (Model Context Protocol) servers deployed to Zephyr Cloud via Module Federation.

## Installation

```bash
npm install zephyr-mcp-server
# or
pnpm add zephyr-mcp-server
```

## Usage

### Starting the Server

The Zephyr MCP Server can load **any** MCP server deployed to Zephyr Cloud. Simply provide the Module Federation manifest URL:

```bash
# Load any MCP server from Zephyr Cloud
npx zephyr-mcp-server start --cloud-url https://[your-server].zephyrcloud.app/mf-manifest.json
```

### Examples

```bash
# GitHub Tools MCP
npx zephyr-mcp-server start --cloud-url https://nestor-lopez-1858-github-tools-mcp-example-zephyr-7d0eb9770-ze.zephyrcloud.app/mf-manifest.json

# Your Custom Database MCP
npx zephyr-mcp-server start --cloud-url https://[user]-[id]-database-mcp-[hash].zephyrcloud.app/mf-manifest.json

# AI Assistant MCP
npx zephyr-mcp-server start --cloud-url https://[user]-[id]-ai-assistant-[hash].zephyrcloud.app/mf-manifest.json
```

### How It Works

1. **Universal Loader**: The host server uses Module Federation to dynamically load any MCP server
2. **Automatic Discovery**: Reads the `mf-manifest.json` to find exposed modules
3. **Dynamic Loading**: Downloads and executes the MCP server code at runtime
4. **Tool Namespacing**: All tools are namespaced by server name to avoid conflicts

### Multiple Servers (Coming Soon)

```bash
# Load multiple MCP servers at once
npx zephyr-mcp-server start \
  --cloud-url https://[github-mcp].zephyrcloud.app/mf-manifest.json \
  --cloud-url https://[database-mcp].zephyrcloud.app/mf-manifest.json \
  --cloud-url https://[ai-mcp].zephyrcloud.app/mf-manifest.json
```

## Integration with MCP Clients

Configure your MCP client (e.g., Claude Desktop) to use any Zephyr-hosted MCP server:

```json
{
  "mcpServers": {
    "my-tools": {
      "command": "npx",
      "args": [
        "zephyr-mcp-server",
        "start",
        "--cloud-url",
        "https://[your-custom-mcp].zephyrcloud.app/mf-manifest.json"
      ]
    }
  }
}
```

## Building Your Own MCP Server for Zephyr

1. Create your MCP server using the `zephyr-mcp-plugin`:

```javascript
// rspack.config.js
import { withZephyr } from 'zephyr-mcp-plugin';

export default withZephyr({
  entry: './src/my-mcp-server.ts',
  mfConfig: {
    name: 'my_custom_mcp',
    exposes: {
      './server': './src/my-mcp-server.ts'
    }
  }
});
```

2. Build and deploy:

```bash
pnpm build
# Automatically uploads to Zephyr Cloud
```

3. Get your manifest URL and use it:

```bash
npx zephyr-mcp-server start --cloud-url https://[your-deployment].zephyrcloud.app/mf-manifest.json
```

## Advanced Options

```bash
# With API key for private servers
npx zephyr-mcp-server start --cloud-url [url] --api-key your-key

# Specify environment
npx zephyr-mcp-server start --cloud-url [url] --env staging

# Filter allowed servers (when using manifests with multiple servers)
npx zephyr-mcp-server start --cloud-url [url] --servers "github,database"

# Disable caching
npx zephyr-mcp-server start --cloud-url [url] --no-cache
```

## Benefits

- **🚀 Zero Configuration**: Just provide a URL and it works
- **🔌 Universal Compatibility**: Works with any MCP server built with zephyr-mcp-plugin
- **🌐 Dynamic Loading**: No need to install MCP servers locally
- **📦 Module Federation**: Leverages webpack's Module Federation for efficient loading
- **🏷️ Automatic Namespacing**: Prevents tool conflicts between servers
- **🔄 Hot Swapping**: Change servers without restarting your client

## Development

```bash
# Clone the repository
git clone https://github.com/ZephyrCloudIO/zephyr-packages.git
cd zephyr-packages/libs/zephyr-mcp-server

# Install dependencies
pnpm install

# Build
pnpm nx build zephyr-mcp-server

# Run locally
node ./dist/cli.js start --cloud-url [manifest-url]
```

## How Module Federation Makes This Possible

Module Federation allows the host server to:
1. Load code dynamically from any Zephyr URL
2. Share dependencies efficiently (e.g., MCP SDK)
3. Isolate different MCP servers while running them in the same process
4. Update servers without changing the host

This means you can:
- Deploy new MCP servers without updating the host
- Mix and match different MCP servers
- Version your MCP servers independently
- Share MCP servers across teams easily

## License

Apache-2.0