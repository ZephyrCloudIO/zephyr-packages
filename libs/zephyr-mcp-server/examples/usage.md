# Zephyr MCP Host Server Usage

The Zephyr MCP Host Server can load MCP servers from Zephyr Cloud URLs, making it easy to dynamically load and aggregate multiple MCP servers.

## Basic Usage

### 1. Start with a manifest URL

```bash
# Load MCP servers from a manifest file hosted on Zephyr
zephyr-mcp-server start --cloud-url https://cdn.zephyr-cloud.io/mcp/my-org/manifest.json

# With authentication
zephyr-mcp-server start \
  --cloud-url https://cdn.zephyr-cloud.io/mcp/my-org/manifest.json \
  --api-key YOUR_ZEPHYR_API_KEY
```

### 2. Manifest Format

The manifest file should be a JSON file with the following structure:

```json
{
  "servers": [
    {
      "id": "github-tools",
      "name": "github-tools",
      "version": "1.0.0",
      "description": "GitHub integration tools",
      "bundleUrl": "https://cdn.zephyr-cloud.io/mcp/github-tools/1.0.0/remoteEntry.js",
      "metadata": {
        "author": "Example Developer",
        "capabilities": {
          "tools": ["create_issue", "search_issues", "create_pr"]
        }
      },
      "status": "active"
    },
    {
      "id": "database-tools",
      "name": "database-tools",
      "version": "2.1.0",
      "description": "Database query and management tools",
      "bundleUrl": "https://cdn.zephyr-cloud.io/mcp/database-tools/2.1.0/remoteEntry.js",
      "metadata": {
        "capabilities": {
          "tools": ["query", "insert", "update", "delete"],
          "resources": ["schemas", "tables"]
        }
      },
      "status": "active"
    }
  ]
}
```

### 3. Direct Server Loading

You can also load specific servers directly:

```bash
# List available servers from a specific organization
zephyr-mcp-server list --cloud-url https://api.zephyr-cloud.io/mcp/acme-corp

# Start with specific servers
zephyr-mcp-server start \
  --cloud-url https://cdn.zephyr-cloud.io/mcp/acme-corp/manifest.json \
  --servers github-tools,database-tools
```

### 4. Environment Variables

```bash
export ZEPHYR_API_KEY=your-api-key
export ZEPHYR_CLOUD_URL=https://cdn.zephyr-cloud.io/mcp/my-org/manifest.json

zephyr-mcp-server start
```

## How It Works

1. **Discovery**: The host server fetches the manifest from the provided Zephyr URL
2. **Loading**: Each MCP server bundle is downloaded from its `bundleUrl`
3. **Module Federation**: If the bundle is a Module Federation remote, it's loaded dynamically
4. **Fallback**: If Module Federation fails, the bundle is executed directly
5. **Aggregation**: All tools, resources, and prompts are namespaced and aggregated
6. **Access**: Tools are accessed as `serverName.toolName` (e.g., `github.create_issue`)

## Publishing MCP Servers to Zephyr

To publish your MCP server to Zephyr:

1. Bundle your MCP server with the Zephyr MCP plugin:

```javascript
// rspack.config.js
import { withZephyr } from 'zephyr-mcp-plugin';

export default withZephyr({
  mfConfig: {
    name: 'my_mcp_server',
    filename: 'remoteEntry.js',
    exposes: {
      './server': './src/index.ts',
    },
  },
  metadata: {
    description: 'My awesome MCP server',
    capabilities: {
      tools: ['tool1', 'tool2'],
    },
  },
})(config);
```

2. Build and deploy:

```bash
npm run build
# The plugin automatically uploads to Zephyr during build
```

3. Your server will be available at:
   - Bundle: `https://cdn.zephyr-cloud.io/mcp/[name]/[version]/remoteEntry.js`
   - Manifest: Updated automatically in your organization's manifest

## Security

- API keys are used for authenticated access to private MCP servers
- Servers run in isolated contexts (sandboxing can be configured)
- All communication uses HTTPS

## Advanced Configuration

```javascript
const config = {
  apiKey: 'your-api-key',
  cloudUrl: 'https://cdn.zephyr-cloud.io/mcp/manifest.json',
  environment: 'production',
  allowedServers: ['github-tools', 'database-tools'],
  cache: {
    enabled: true,
    ttl: 3600000, // 1 hour
  },
  sandbox: {
    enabled: true,
    memoryLimit: 256 * 1024 * 1024, // 256MB
    timeout: 30000, // 30 seconds
  },
};

const server = await createZephyrHostServer(config);
await server.start();
```