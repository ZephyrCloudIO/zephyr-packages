# Zephyr Next.js Adapter

A Next.js deployment adapter that integrates with the Zephyr Cloud platform using the official Next.js Adapter API. This adapter replaces the webpack plugin approach with a cleaner, more reliable solution that waits for the complete build to finish before creating a single snapshot.

## Overview

The Zephyr Next.js Adapter provides:

- **Single Snapshot Upload**: Creates one comprehensive snapshot after the entire build completes
- **Official Next.js Integration**: Uses the Next.js Adapter API for reliable integration
- **Complete Build Capture**: Captures all outputs including static assets, server functions, edge functions, and manifests
- **Module Federation Ready**: First-class support for micro-frontend architecture
- **Zephyr Cloud Integration**: Seamless deployment to Zephyr's edge worker network

## Migration from Webpack Plugin

### Before (Webpack Plugin)
```javascript
// next.config.js (OLD)
const { withZephyr } = require('zephyr-nextjs-plugin')

module.exports = withZephyr({
  // Next.js config
}, {
  // Zephyr plugin config
  orgId: process.env.ZEPHYR_ORG_ID,
  projectId: process.env.ZEPHYR_PROJECT_ID
})
```

### After (Adapter)
```javascript
// next.config.js (NEW)
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    adapterPath: 'zephyr-nextjs-adapter'
  }
}

module.exports = nextConfig
```

## Installation

```bash
npm install zephyr-nextjs-adapter
# or
yarn add zephyr-nextjs-adapter
# or
pnpm add zephyr-nextjs-adapter
```

## Usage

### 1. Basic Setup

Update your `next.config.js`:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    adapterPath: 'zephyr-nextjs-adapter'
  },
  // Your existing Next.js configuration
  reactStrictMode: true,
  // ...
}

module.exports = nextConfig
```

### 2. Authentication (Optional)

The adapter automatically discovers your organization and project from git, so you only need authentication:

**Option A: Environment Variable**
```bash
export ZEPHYR_API_KEY=your-api-key
```

**Option B: Zephyr CLI Login (Recommended)**
```bash
npx zephyr login
# This stores your authentication token automatically
```

**Optional Configuration:**
```bash
# Optional - auto-detected from NODE_ENV
ZEPHYR_ENVIRONMENT=development|staging|production

# Optional - defaults to false
ZEPHYR_MODULE_FEDERATION=true|false
```

The adapter will automatically detect:
- **Organization & Project**: From your git remote origin URL
- **Package Name & Version**: From your package.json
- **Git Branch & Commit**: From your current git state
- **Build Environment**: From NODE_ENV

### 3. Build Your Application

```bash
npm run build
```

The adapter will:
1. Let Next.js complete the entire build process
2. Capture all build outputs and metadata
3. Create a single comprehensive snapshot
4. Upload to Zephyr Cloud

## Advanced Configuration

### Custom Adapter Configuration

Create a custom adapter file for advanced use cases:

```javascript
// zephyr.adapter.mjs
import { createZephyrAdapter } from 'zephyr-nextjs-adapter'

export default createZephyrAdapter({
  // Custom configuration options
  uploadBatchSize: 50,
  enableDetailedLogging: true,
  customAssetFilter: (asset) => {
    // Filter assets before upload
    return !asset.pathname.includes('/_error')
  },
  customMetadata: {
    deploymentVersion: '1.2.3',
    buildHash: process.env.BUILD_HASH
  }
})
```

Then reference it in your `next.config.js`:

```javascript
module.exports = {
  experimental: {
    adapterPath: './zephyr.adapter.mjs'
  }
}
```

### Environment-Specific Behavior

```javascript
// zephyr.adapter.mjs
import { createZephyrAdapter } from 'zephyr-nextjs-adapter'

export default createZephyrAdapter({
  onBuildComplete: async (ctx) => {
    const isDevelopment = process.env.NODE_ENV === 'development'
    
    if (isDevelopment) {
      console.log('Development mode - skipping upload')
      return
    }
    
    // Production upload logic
    await uploadToZephyr(ctx)
  }
})
```

## Integration with Existing Zephyr Infrastructure

The adapter integrates seamlessly with your existing Zephyr infrastructure:

```javascript
// Example integration with ZephyrEngine
import { ZephyrEngine } from 'zephyr-agent'
import { createZephyrAdapter } from 'zephyr-nextjs-adapter'

export default createZephyrAdapter({
  onBuildComplete: async (ctx) => {
    const zephyrEngine = new ZephyrEngine({
      orgId: process.env.ZEPHYR_ORG_ID,
      projectId: process.env.ZEPHYR_PROJECT_ID,
      apiKey: process.env.ZEPHYR_API_KEY
    })
    
    // Convert Next.js outputs to Zephyr format
    const assetsMap = convertToZephyrFormat(ctx.outputs)
    
    // Use existing upload infrastructure
    await zephyrEngine.upload_assets({
      assetsMap,
      buildStats: generateBuildStats(ctx)
    })
  }
})
```

## Build Output Structure

The adapter captures and processes all Next.js build outputs:

### Static Assets
- CSS files (`/_next/static/css/`)
- JavaScript chunks (`/_next/static/chunks/`)
- Images and other assets
- Public folder contents

### Server Functions
- App Router pages (SSR/SSG)
- Pages Router pages (legacy)
- API routes
- Server Components

### Edge Functions
- Edge API routes
- Middleware
- Edge Runtime pages

### Manifests and Metadata
- Routes configuration
- Build statistics
- Dependency traces
- Function configurations

## Comparison with Webpack Plugin

| Feature | Webpack Plugin | Next.js Adapter |
|---------|---------------|-----------------|
| **Upload Timing** | During compilation | After complete build |
| **Integration** | Webpack hooks | Official Next.js API |
| **Reliability** | Fragile webpack internals | Stable Next.js interface |
| **Build Capture** | Partial (compilation-time) | Complete (final state) |
| **Configuration** | Complex webpack setup | Simple Next.js config |
| **Maintenance** | High (webpack changes) | Low (stable API) |

## Troubleshooting

### Common Issues

1. **"adapterPath not recognized"**
   - Ensure you're using Next.js 14+ 
   - Check that the experimental adapter API is available

2. **Environment variables not set**
   - Verify `ZEPHYR_ORG_ID`, `ZEPHYR_PROJECT_ID`, and `ZEPHYR_API_KEY` are set
   - Check the adapter logs for specific missing variables

3. **Upload failures**
   - Check network connectivity to Zephyr Cloud
   - Verify API key permissions
   - Review build logs for detailed error messages

### Debug Mode

Enable detailed logging:

```bash
DEBUG=zephyr:* npm run build
```

Or set the environment variable:

```bash
ZEPHYR_DEBUG=true npm run build
```

### Build Manifest

The adapter creates a manifest file for debugging:

```bash
# Check the generated manifest
cat .next/zephyr-snapshot-manifest.json
```

## API Reference

### Configuration Options

```typescript
interface ZephyrAdapterConfig {
  // Upload configuration
  uploadBatchSize?: number
  uploadTimeout?: number
  
  // Filtering options
  customAssetFilter?: (asset: AdapterOutput) => boolean
  excludePatterns?: string[]
  
  // Metadata customization
  customMetadata?: Record<string, any>
  
  // Logging options
  enableDetailedLogging?: boolean
  logLevel?: 'error' | 'warn' | 'info' | 'debug'
  
  // Custom hooks
  onBuildStart?: () => Promise<void> | void
  onBuildComplete?: (ctx: BuildContext) => Promise<void> | void
  onUploadStart?: (snapshot: Snapshot) => Promise<void> | void
  onUploadComplete?: (result: UploadResult) => Promise<void> | void
}
```

### Build Context

```typescript
interface BuildContext {
  routes: {
    headers: Array<HeaderRoute>
    redirects: Array<RedirectRoute>
    rewrites: RewriteRoutes
    dynamicRoutes: Array<DynamicRoute>
  }
  outputs: Array<{
    id: string
    pathname: string
    filePath: string
    type: RouteType
    runtime?: 'nodejs' | 'edge'
    config?: FunctionConfig
    assets?: Record<string, string>
    fallbackID?: string
  }>
}
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

MIT - see [LICENSE](./LICENSE) file for details.

## Support

- [GitHub Issues](https://github.com/zephyr-cloud/zephyr-packages/issues)
- [Documentation](https://docs.zephyr-cloud.io)
- [Community Discord](https://discord.gg/zephyr-cloud)