# Interactive Usage with Zephyr URLs

When you deploy MCP servers to Zephyr using the `zephyr-mcp-plugin`, each server gets a unique URL. The host server can load these directly.

## Interactive Mode

When you start the host server without a manifest URL, it will prompt you for MCP server URLs:

```bash
$ zephyr-mcp-server start

Starting Zephyr MCP Host Server...
================================

Enter Zephyr MCP server URLs (one per line).
Example: https://nestor-lopez-1853-github-tools-mcp-example-zephyr-f1e0463b8-ze.zephyrcloud.app/remoteEntry.js
Press Enter when done.

MCP URL (or press Enter to finish): https://nestor-lopez-1853-github-tools-mcp-example-zephyr-f1e0463b8-ze.zephyrcloud.app/remoteEntry.js
✓ Added: https://nestor-lopez-1853-github-tools-mcp-example-zephyr-f1e0463b8-ze.zephyrcloud.app/remoteEntry.js

MCP URL (or press Enter to finish): https://john-doe-4567-database-tools-mcp-zephyr-a2b3c4d5e-ze.zephyrcloud.app/remoteEntry.js
✓ Added: https://john-doe-4567-database-tools-mcp-zephyr-a2b3c4d5e-ze.zephyrcloud.app/remoteEntry.js

MCP URL (or press Enter to finish): 

Loading 2 MCP server(s)...

✓ Host server initialized
✓ Connecting to stdio...
```

## Understanding Zephyr URLs

Zephyr automatically generates URLs for your deployed MCP servers in this format:

```
https://[user]-[id]-[server-name]-zephyr-[hash]-ze.zephyrcloud.app/remoteEntry.js
```

Where:
- `[user]` - Your username or organization
- `[id]` - A unique identifier
- `[server-name]` - The name of your MCP server
- `[hash]` - A deployment hash
- `remoteEntry.js` - The Module Federation entry point

## Getting Your MCP Server URLs

### Option 1: From Build Output

When you build your MCP server with the Zephyr plugin, the URL is displayed:

```bash
$ npm run build

Building github-tools-mcp...
✓ Bundle created
✓ Uploaded to Zephyr Cloud

Your MCP server is available at:
https://nestor-lopez-1853-github-tools-mcp-example-zephyr-f1e0463b8-ze.zephyrcloud.app/remoteEntry.js
```

### Option 2: From Zephyr Dashboard

1. Log in to your Zephyr dashboard
2. Navigate to your MCP servers
3. Copy the deployment URL

### Option 3: From CLI

```bash
# List your deployed MCP servers
$ zephyr list --type mcp

NAME                VERSION    URL
github-tools-mcp    1.0.0     https://nestor-lopez-1853-github-tools-mcp-example-zephyr-f1e0463b8-ze.zephyrcloud.app/remoteEntry.js
database-tools-mcp  2.1.0     https://john-doe-4567-database-tools-mcp-zephyr-a2b3c4d5e-ze.zephyrcloud.app/remoteEntry.js
```

## Using Environment Variables

You can also set URLs via environment:

```bash
export MCP_URLS="https://url1/remoteEntry.js,https://url2/remoteEntry.js"
zephyr-mcp-server start
```

## Tool Namespacing

Once loaded, tools from different servers are namespaced:

- From `github-tools-mcp`: 
  - `github-tools-mcp.create_issue`
  - `github-tools-mcp.search_issues`
  
- From `database-tools-mcp`:
  - `database-tools-mcp.query`
  - `database-tools-mcp.insert`

## Example Session

```bash
# Start the host server
$ zephyr-mcp-server start

# Enter your MCP URLs when prompted
MCP URL: https://your-github-tools-url.zephyrcloud.app/remoteEntry.js
MCP URL: https://your-database-tools-url.zephyrcloud.app/remoteEntry.js
MCP URL: [press Enter]

# The host server is now running and aggregating all tools!
```

## Tips

1. **Save Your URLs**: Keep a list of your commonly used MCP server URLs
2. **Use Manifest Files**: For production, create a manifest file with all your servers
3. **Version Control**: Include specific versions in your URLs when needed
4. **Authentication**: Add `--api-key` if your servers require authentication