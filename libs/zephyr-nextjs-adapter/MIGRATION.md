# Migration from Webpack Plugin to Next.js Adapter

This guide helps you migrate from the existing `zephyr-nextjs-plugin` (webpack approach) to the new `zephyr-nextjs-adapter` (Next.js Adapter API approach).

## Why Migrate?

### Current Webpack Plugin Issues
- ❌ **Multiple uploads during build**: Uploads happen at different webpack compilation phases
- ❌ **Fragile integration**: Relies on webpack internals that can change
- ❌ **Incomplete capture**: May miss final build state and post-processing outputs
- ❌ **Complex coordination**: Difficult to coordinate between client/server builds

### New Adapter Benefits
- ✅ **Single snapshot upload**: Waits for complete build before uploading
- ✅ **Official Next.js API**: Uses stable, documented Next.js interfaces
- ✅ **Complete build capture**: Captures everything including post-processing
- ✅ **Cleaner architecture**: No webpack hooks, simpler configuration

## Migration Steps

### 1. Install the New Adapter

```bash
# Install the new adapter
npm install zephyr-nextjs-adapter

# Optional: Remove the old plugin
npm uninstall zephyr-nextjs-plugin
```

### 2. Update Next.js Configuration

**Before (Webpack Plugin):**
```javascript
// next.config.js
const { withZephyr } = require('zephyr-nextjs-plugin')

module.exports = withZephyr({
  reactStrictMode: true,
  // other Next.js config
}, {
  orgId: process.env.ZEPHYR_ORG_ID,
  projectId: process.env.ZEPHYR_PROJECT_ID,
  // other Zephyr config
})
```

**After (Adapter):**
```javascript
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    adapterPath: 'zephyr-nextjs-adapter'
  },
  reactStrictMode: true,
  // other Next.js config
}

module.exports = nextConfig
```

### 3. Simplified Configuration

**Good news**: You can remove most environment variables! The adapter auto-discovers everything from git and package.json, just like your other Zephyr plugins.

**Before (Manual Configuration):**
```bash
# Required
ZEPHYR_ORG_ID=your-organization-id  # ❌ No longer needed
ZEPHYR_PROJECT_ID=your-project-id   # ❌ No longer needed
ZEPHYR_API_KEY=your-api-key         # ✅ Still needed (or use `zephyr login`)

# Optional
ZEPHYR_ENVIRONMENT=development       # ❌ Auto-detected from NODE_ENV
ZEPHYR_MODULE_FEDERATION=true       # ✅ Optional
ZEPHYR_BUILD_ID=custom-build-id     # ❌ Auto-generated
```

**After (Auto-Discovery):**
```bash
# Only authentication is needed
ZEPHYR_API_KEY=your-api-key
# OR use: npx zephyr login

# Optional overrides
ZEPHYR_MODULE_FEDERATION=true  # If you want module federation
```

**Auto-Discovered:**
- ✅ **Organization & Project**: From git remote origin URL
- ✅ **Package Name & Version**: From package.json  
- ✅ **Git Branch & Commit**: From current git state
- ✅ **Build Environment**: From NODE_ENV
- ✅ **Build ID**: Auto-generated with package info

### 4. Build Process Changes

**Before:**
```bash
npm run build
# Multiple uploads during build:
# 1. Static assets during webpack client build
# 2. Server functions during webpack server build  
# 3. Final manifest after Next.js post-processing
```

**After:**
```bash
npm run build
# Single upload after complete build:
# 1. Next.js completes entire build process
# 2. Adapter captures all outputs
# 3. Single comprehensive snapshot upload
```

## Advanced Migration

### Custom Configuration

If you need custom behavior, create a custom adapter:

```javascript
// zephyr.adapter.mjs
import { createZephyrAdapter } from 'zephyr-nextjs-adapter'

export default createZephyrAdapter({
  enableDetailedLogging: true,
  customAssetFilter: (asset) => {
    // Custom filtering logic
    return !asset.pathname.includes('/_error')
  },
  customMetadata: {
    version: '1.0.0',
    buildHash: process.env.BUILD_HASH
  }
})
```

Then update your Next.js config:

```javascript
// next.config.js
module.exports = {
  experimental: {
    adapterPath: './zephyr.adapter.mjs'
  }
}
```

### Environment-Specific Adapters

```javascript
// zephyr.adapter.mjs
import { 
  createZephyrAdapter, 
  createDevelopmentAdapter, 
  createProductionAdapter,
  createCIAdapter 
} from 'zephyr-nextjs-adapter'

const isDevelopment = process.env.NODE_ENV === 'development'
const isCI = process.env.CI === 'true'

if (isDevelopment) {
  export default createDevelopmentAdapter()
} else if (isCI) {
  export default createCIAdapter()
} else {
  export default createProductionAdapter()
}
```

## Verification

### 1. Check Build Output

The adapter creates a manifest file you can inspect:

```bash
# After build completes
cat .next/zephyr-snapshot-manifest.json
```

### 2. Compare Asset Counts

**Webpack Plugin Output:**
- Check previous build logs for asset counts
- Multiple upload events with partial counts

**Adapter Output:**
```bash
# Look for this in build output:
📦 Converted assets:
   - Static assets: 25
   - Server functions: 8  
   - Edge functions: 2
   - Pre-rendered pages: 0
   - Public assets: 3
   - Manifests: 1
```

### 3. Timing Comparison

**Before (Webpack Plugin):**
- Uploads happen during compilation
- Build may appear slower due to network I/O during webpack phases

**After (Adapter):**
- Uploads happen after build completes
- Build completes faster, upload happens at end

## Troubleshooting

### Common Issues

1. **"adapterPath not recognized"**
   - Ensure Next.js version supports experimental adapter API
   - Check Next.js version: `npm list next`

2. **Build fails with adapter errors**
   - Check environment variables are set
   - Verify adapter file exists and exports default

3. **Missing assets in upload**
   - Check `.next/zephyr-snapshot-manifest.json` for complete asset list
   - Compare with previous webpack plugin uploads

### Debug Mode

Enable detailed logging:

```bash
ZEPHYR_DEBUG=true npm run build
```

### Rollback Plan

If you need to rollback to the webpack plugin:

1. **Revert Next.js config:**
```diff
module.exports = {
-  experimental: {
-    adapterPath: 'zephyr-nextjs-adapter'
-  }
}
```

2. **Reinstall webpack plugin:**
```bash
npm install zephyr-nextjs-plugin
```

3. **Restore webpack plugin config:**
```javascript
const { withZephyr } = require('zephyr-nextjs-plugin')
module.exports = withZephyr({...}, {...})
```

## Testing Both Approaches

You can test both approaches in parallel:

1. **Keep webpack plugin config** in a separate branch
2. **Use adapter in main branch**
3. **Compare build outputs** and upload results
4. **Verify functionality** in both deployments

## Benefits Verification

After migration, you should see:

- ✅ **Faster builds** (no webpack plugin overhead)
- ✅ **More reliable uploads** (single atomic operation)
- ✅ **Complete asset capture** (includes post-processing outputs)
- ✅ **Better error handling** (cleaner error messages)
- ✅ **Simplified configuration** (no webpack complexity)

## Support

If you encounter issues during migration:

1. Check the [troubleshooting guide](./README.md#troubleshooting)
2. Compare manifest files between approaches
3. Test with development adapter first
4. Report issues with detailed logs and configuration