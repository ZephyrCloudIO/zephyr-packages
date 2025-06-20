# zephyr-mcp-server

The Zephyr MCP Host Server that dynamically loads and aggregates MCP servers from Zephyr Cloud URLs.

## Features

- 🌐 **URL-Based Loading**: Load MCP servers from Zephyr CDN URLs or manifest files
- 🔗 **Unified Interface**: Aggregates all tools, resources, and prompts from multiple servers
- 📦 **Module Federation**: Uses Module Federation for runtime loading
- 🔒 **Sandboxed Execution**: Runs loaded servers in isolated environments
- 🏷️ **Namespace Isolation**: Tools are namespaced by server (e.g., `github.create_issue`)
- 📊 **Manifest Support**: Define available servers via JSON manifests

## Installation

```bash
npm install -g zephyr-mcp-server
```

## Usage

### Interactive Mode (Recommended)

When you start the server without arguments, it will prompt you for Zephyr MCP URLs:

```bash
$ zephyr-mcp-server start

Starting Zephyr MCP Host Server...
================================

Enter Zephyr MCP server URLs (one per line).
Example: https://nestor-lopez-1853-github-tools-mcp-example-zephyr-f1e0463b8-ze.zephyrcloud.app/remoteEntry.js
Press Enter when done.

MCP URL (or press Enter to finish): [paste your URL here]
```

### Command Line Options

```bash
# Start with a manifest URL
zephyr-mcp-server start --cloud-url https://cdn.zephyr-cloud.io/mcp/my-org/manifest.json

# With authentication
zephyr-mcp-server start \
  --api-key YOUR_API_KEY \
  --servers github-tools,database-tools

# List available servers from a manifest
zephyr-mcp-server list --cloud-url https://cdn.zephyr-cloud.io/mcp/my-org/manifest.json
```

### Environment Variables

```bash
export ZEPHYR_API_KEY=your-api-key
export ZEPHYR_CLOUD_URL=https://cdn.zephyr-cloud.io/mcp/my-org/manifest.json
zephyr-mcp-server start
```

### Programmatic Usage

```typescript
import { createZephyrHostServer } from 'zephyr-mcp-server';

const host = await createZephyrHostServer({
  apiKey: 'your-api-key',
  cloudUrl: 'https://cdn.zephyr-cloud.io/mcp/my-org/manifest.json',
  environment: 'production',
  allowedServers: ['github-tools', 'database-tools'],
  cache: {
    enabled: true,
    ttl: 3600000, // 1 hour
  },
});

await host.connect(process.stdin, process.stdout);
```

## Configuration

```typescript
interface ZephyrHostConfig {
  // Zephyr API key
  apiKey?: string;

  // Zephyr Cloud URL or manifest URL
  cloudUrl?: string;

  // Environment (production, staging, dev)
  environment?: 'production' | 'staging' | 'dev';

  // Filter specific servers (omit to load all)
  allowedServers?: string[];

  // Cache settings
  cache?: {
    enabled: boolean;
    ttl: number; // milliseconds
  };

  // Sandbox settings
  sandbox?: {
    enabled: boolean;
    memoryLimit?: number;
    timeout?: number;
  };
}
```

## How It Works

1. **URL Input**: Prompts for or accepts Zephyr MCP server URLs
2. **Discovery**: Fetches server bundles from provided URLs
3. **Loading**: Dynamically imports servers using Module Federation
4. **Registration**: Registers all tools, resources, and prompts
5. **Namespacing**: Prefixes all capabilities with server name
6. **Routing**: Routes requests to appropriate servers

## Zephyr URLs

When you deploy an MCP server with `zephyr-mcp-plugin`, Zephyr generates a unique URL:

```
https://[user]-[id]-[server-name]-zephyr-[hash]-ze.zephyrcloud.app/remoteEntry.js
```

Example:
```
https://nestor-lopez-1853-github-tools-mcp-example-zephyr-f1e0463b8-ze.zephyrcloud.app/remoteEntry.js
```

These URLs are provided after building your MCP server and can be used directly with the host server.

## Tool Namespacing

Tools from different servers are namespaced to avoid conflicts:

- `github.create_issue` → GitHub server's `create_issue` tool
- `database.query` → Database server's `query` tool
- `ai.generate` → AI server's `generate` tool

## Security

- **Authentication**: Requires valid Zephyr API key
- **Sandboxing**: Loaded servers run in isolated contexts
- **Access Control**: Can restrict which servers to load
- **HTTPS Only**: All communication encrypted

## Examples

### Basic Usage

```bash
# Start with a manifest URL
zephyr-mcp-server start --cloud-url https://cdn.zephyr-cloud.io/mcp/acme/manifest.json
```

### Filtered Servers

```bash
# Only load specific servers
zephyr-mcp-server start --servers github-tools,jira-tools
```

### Development Mode

```bash
# Use staging environment
zephyr-mcp-server start --env staging --no-cache
```

## Troubleshooting

### Server Not Loading

1. Check your API key is valid
2. Verify the server is active in Zephyr Cloud
3. Check network connectivity
4. Try with `--no-cache` flag

### Authentication Errors

```bash
# Set API key
export ZEPHYR_API_KEY=your-api-key

# Or pass directly
zephyr-mcp-server start --api-key your-api-key
```

### Debug Mode

```bash
# Enable debug logging
DEBUG=zephyr:* zephyr-mcp-server start
```

## License

MIT
