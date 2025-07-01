/**
 * Custom Zephyr Next.js Adapter Example
 * 
 * This example shows how to create a custom adapter with
 * specific configuration and filtering.
 */

import { createZephyrAdapter } from 'zephyr-nextjs-adapter'

// Create a custom adapter with specific configuration
export default createZephyrAdapter({
  // Enable detailed logging for debugging
  enableDetailedLogging: true,
  
  // Custom asset filtering
  customAssetFilter: (asset) => {
    // Skip source maps in production
    if (process.env.NODE_ENV === 'production' && asset.pathname.endsWith('.map')) {
      return false
    }
    
    // Skip development-only assets
    if (asset.pathname.includes('/_error') || asset.pathname.includes('/_app')) {
      return false
    }
    
    return true
  },
  
  // Exclude specific patterns
  excludePatterns: [
    '/test/',
    '/__debug/',
    '.test.js',
    '.spec.js'
  ],
  
  // Add custom metadata to the snapshot
  customMetadata: {
    deploymentVersion: process.env.DEPLOYMENT_VERSION || '1.0.0',
    buildTimestamp: new Date().toISOString(),
    gitCommit: process.env.GIT_COMMIT,
    buildEnvironment: process.env.NODE_ENV
  },
  
  // Custom hooks
  onBuildStart: async () => {
    console.log('🚀 Starting Zephyr deployment process...')
  },
  
  onUploadStart: async (snapshot) => {
    console.log(`📤 Uploading snapshot ${snapshot.id} with ${snapshot.metadata.totalOutputs} assets`)
  },
  
  onUploadComplete: async (result) => {
    if (result.success) {
      console.log(`✅ Successfully uploaded ${result.uploadedAssets} assets`)
      console.log(`🔗 Build ID: ${result.buildId}`)
    } else {
      console.error(`❌ Upload failed:`, result.errors)
    }
  }
})

/*
Usage in next.config.js:

module.exports = {
  experimental: {
    adapterPath: './examples/custom.mjs'
  }
}
*/