/**
 * Environment-Specific Zephyr Next.js Adapter Example
 * 
 * This example shows how to use different adapter configurations
 * based on the environment (development, staging, production).
 */

import { 
  createDevelopmentAdapter, 
  createProductionAdapter,
  createCIAdapter,
  createZephyrAdapter 
} from 'zephyr-nextjs-adapter'

const environment = process.env.NODE_ENV
const isCI = process.env.CI === 'true'

// Choose adapter based on environment
let adapter

if (environment === 'development') {
  // Development: Skip uploads, just log build info
  adapter = createDevelopmentAdapter()
  
} else if (isCI) {
  // CI/CD: Add CI-specific metadata and logging
  adapter = createCIAdapter()
  
} else if (environment === 'production') {
  // Production: Full upload with optimizations
  adapter = createProductionAdapter(100) // Batch size of 100
  
} else {
  // Staging or other environments: Custom configuration
  adapter = createZephyrAdapter({
    enableDetailedLogging: true,
    uploadBatchSize: 50,
    
    customAssetFilter: (asset) => {
      // In staging, include more debug assets
      return true
    },
    
    customMetadata: {
      environment: environment || 'staging',
      buildNumber: process.env.BUILD_NUMBER,
      branch: process.env.GIT_BRANCH
    },
    
    onUploadComplete: async (result) => {
      // Send notification in staging
      if (result.success) {
        console.log(`🎯 Staging deployment completed: ${result.buildId}`)
        // Could send Slack notification here
      }
    }
  })
}

export default adapter

/*
Usage in next.config.js:

module.exports = {
  experimental: {
    adapterPath: './examples/environment-specific.mjs'
  }
}

Environment Variables:
- NODE_ENV=development|staging|production
- CI=true (for CI environments)
- BUILD_NUMBER=123 (for build tracking)
- GIT_BRANCH=main (for branch tracking)
*/