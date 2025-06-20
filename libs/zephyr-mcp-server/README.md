# zephyr-mcp-server

The Zephyr MCP Host Server that dynamically loads and aggregates MCP servers deployed to Zephyr Cloud.

## Features

- 🌐 **Dynamic Loading**: Automatically discovers and loads MCP servers from Zephyr Cloud
- 🔗 **Unified Interface**: Aggregates all tools, resources, and prompts from multiple servers
- 📦 **Module Federation**: Uses Module Federation for runtime loading
- 🔒 **Sandboxed Execution**: Runs loaded servers in isolated environments
- 🏷️ **Namespace Isolation**: Tools are namespaced by server (e.g., `github.create_issue`)
- 📊 **Built-in Monitoring**: Tracks server health and performance

## Installation

```bash
npm install -g zephyr-mcp-server
```

## Usage

### Command Line

```bash
# Start the host server
zephyr-mcp-server start

# With options
zephyr-mcp-server start \
  --api-key YOUR_API_KEY \
  --env production \
  --servers github-tools,database-tools

# List available servers
zephyr-mcp-server list
```

### Environment Variables

```bash
export ZEPHYR_API_KEY=your-api-key
export ZEPHYR_ENV=production
zephyr-mcp-server start
```

### Programmatic Usage

```typescript
import { createZephyrHostServer } from 'zephyr-mcp-server';

const host = await createZephyrHostServer({
  apiKey: 'your-api-key',
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

1. **Discovery**: Queries Zephyr Cloud for available MCP servers
2. **Download**: Fetches server bundles using authenticated requests
3. **Loading**: Dynamically imports servers using Module Federation
4. **Registration**: Registers all tools, resources, and prompts
5. **Namespacing**: Prefixes all capabilities with server name
6. **Routing**: Routes requests to appropriate servers

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
# Start with default settings
ZEPHYR_API_KEY=your-key zephyr-mcp-server start
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