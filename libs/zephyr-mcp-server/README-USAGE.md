# Zephyr MCP Server - Usage Guide

## Current Status

The Zephyr MCP Server is designed to load MCP servers deployed to Zephyr Cloud. However, there's a key consideration:

### Module Federation vs Direct Bundles

When you deploy with `zephyr-mcp-plugin`, it creates Module Federation bundles with URLs like:
```
https://[user]-[id]-[name]-zephyr-[hash]-ze.zephyrcloud.app/remoteEntry.js
```

These are Module Federation entry points, not standalone bundles. The MCP host server currently expects standalone CommonJS bundles that export a server factory function.

## Solutions

### Option 1: Build Standalone Bundles (Recommended for MCP)

When building your MCP server, create a standalone bundle in addition to the Module Federation build:

```javascript
// rspack.config.js for MCP server
export default {
  entry: './src/index.ts',
  output: {
    filename: 'bundle.js',  // Standalone bundle
    libraryTarget: 'commonjs2',
  },
  // ... rest of config
};
```

Then the URL would be:
```
https://[...].zephyrcloud.app/bundle.js
```

### Option 2: Use Module Federation Runtime (Future Enhancement)

We could enhance the host server to properly initialize Module Federation runtime and load remotes dynamically. This would require:

1. Setting up the Module Federation runtime properly
2. Loading the remoteEntry.js 
3. Accessing the exposed modules
4. Creating server instances from them

### Option 3: Direct Module Loading

For testing, you can try the direct module URL:
```
https://[...].zephyrcloud.app/__federation_expose_github.js
```

## Testing the Current Implementation

```bash
# Start the server
node ./dist/cli.js start

# When prompted, try entering:
# 1. The main.js URL instead of remoteEntry.js
# 2. A direct bundle URL if available
```

## Expected Bundle Format

The host server expects bundles that export a server factory function:

```javascript
// Option 1: Default export
module.exports = async function createServer() {
  const server = new Server({ name: 'my-server', version: '1.0.0' });
  // ... setup handlers
  return server;
};

// Option 2: Named export
module.exports = {
  createServer: async function() {
    // ... return server
  }
};

// Option 3: Direct server instance
const server = new Server({ name: 'my-server', version: '1.0.0' });
// ... setup handlers
module.exports = server;
```

## Next Steps

1. **For MCP Server Developers**: Build standalone bundles alongside Module Federation builds
2. **For Host Server**: Implement proper Module Federation runtime support
3. **For Testing**: Use direct bundle URLs or exposed module URLs

## Environment Variables

```bash
# Optional API key for private servers
export ZEPHYR_API_KEY=your-key

# Start the server
node ./dist/cli.js start
```