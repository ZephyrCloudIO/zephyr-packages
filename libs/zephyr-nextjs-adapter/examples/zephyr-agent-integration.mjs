/**
 * Zephyr Agent Integration Example
 * 
 * This example shows how to integrate the adapter with existing
 * Zephyr Agent infrastructure for seamless compatibility.
 */

import { createZephyrAdapter } from 'zephyr-nextjs-adapter'

// Custom adapter that integrates with existing Zephyr infrastructure
export default createZephyrAdapter({
  enableDetailedLogging: true,
  
  // Custom build complete handler that uses existing Zephyr Agent
  onBuildComplete: async (ctx) => {
    console.log('🔧 Using existing Zephyr Agent infrastructure...')
    
    try {
      // Import existing Zephyr infrastructure
      const { ZephyrEngine } = await import('zephyr-agent')
      const { createSnapshot } = await import('zephyr-agent/lib/transformers/ze-build-snapshot')
      
      // Initialize ZephyrEngine with existing configuration
      const zephyrEngine = new ZephyrEngine({
        orgId: process.env.ZEPHYR_ORG_ID,
        projectId: process.env.ZEPHYR_PROJECT_ID,
        apiKey: process.env.ZEPHYR_API_KEY,
        environment: process.env.ZEPHYR_ENVIRONMENT || 'development'
      })
      
      console.log('⚙️  ZephyrEngine initialized successfully')
      
      // Convert Next.js outputs to format expected by ZephyrEngine
      const assetsMap = convertNextJSOutputsToZephyrFormat(ctx.outputs)
      
      // Generate build statistics
      const buildStats = {
        buildId: `nextjs-${Date.now()}`,
        environment: process.env.ZEPHYR_ENVIRONMENT || 'development',
        framework: 'nextjs',
        timestamp: new Date().toISOString(),
        totalOutputs: ctx.outputs.length,
        outputTypes: getOutputTypeCounts(ctx.outputs)
      }
      
      console.log(`📊 Converted ${ctx.outputs.length} outputs to Zephyr format`)
      
      // Use existing ZephyrEngine upload infrastructure
      const result = await zephyrEngine.upload_assets({
        assetsMap,
        buildStats
      })
      
      console.log('✅ Successfully uploaded via existing Zephyr Agent')
      console.log(`🔗 Build ID: ${result.buildId}`)
      
      return result
      
    } catch (error) {
      console.error('❌ Failed to use Zephyr Agent infrastructure:', error)
      
      // Fallback to adapter's default behavior
      console.log('🔄 Falling back to adapter default upload...')
      throw error // This will trigger the adapter's default upload logic
    }
  }
})

/**
 * Convert Next.js adapter outputs to format expected by existing ZephyrEngine
 */
function convertNextJSOutputsToZephyrFormat(outputs) {
  const assetsMap = {
    // Static assets for CDN
    staticAssets: [],
    
    // Server functions for API deployment
    serverFunctions: [],
    
    // Edge functions for edge worker deployment
    edgeFunctions: [],
    
    // Build metadata
    buildMetadata: {
      framework: 'nextjs',
      adapterVersion: '1.0.0'
    }
  }
  
  for (const output of outputs) {
    const asset = {
      id: output.id,
      pathname: output.pathname,
      filePath: output.filePath,
      type: output.type,
      runtime: output.runtime,
      config: output.config,
      assets: output.assets || {},
      
      // Add Zephyr-specific metadata
      zephyrMetadata: {
        deploymentTarget: determineDeploymentTarget(output),
        moduleFederationCompatible: isModuleFederationCompatible(output),
        cacheable: isCacheable(output)
      }
    }
    
    // Route to appropriate collection
    switch (asset.zephyrMetadata.deploymentTarget) {
      case 'cdn':
        assetsMap.staticAssets.push(asset)
        break
      case 'edge':
        assetsMap.edgeFunctions.push(asset)
        break
      case 'server':
        assetsMap.serverFunctions.push(asset)
        break
    }
  }
  
  return assetsMap
}

/**
 * Determine deployment target for an output
 */
function determineDeploymentTarget(output) {
  switch (output.type) {
    case 'STATIC_FILE':
    case 'IMAGE':
      return 'cdn'
    case 'MIDDLEWARE':
      return 'edge'
    case 'APP_ROUTE':
    case 'PAGES_API':
      return output.runtime === 'edge' ? 'edge' : 'server'
    case 'APP_PAGE':
    case 'PAGES':
      return output.runtime === 'edge' ? 'edge' : 'server'
    default:
      return 'server'
  }
}

/**
 * Check if output is module federation compatible
 */
function isModuleFederationCompatible(output) {
  return ['STATIC_FILE', 'APP_PAGE', 'PAGES'].includes(output.type)
}

/**
 * Check if output is cacheable
 */
function isCacheable(output) {
  return ['STATIC_FILE', 'IMAGE'].includes(output.type)
}

/**
 * Get count of outputs by type for statistics
 */
function getOutputTypeCounts(outputs) {
  return outputs.reduce((acc, output) => {
    acc[output.type] = (acc[output.type] || 0) + 1
    return acc
  }, {})
}

/*
Usage in next.config.js:

module.exports = {
  experimental: {
    adapterPath: './examples/zephyr-agent-integration.mjs'
  }
}

This adapter will:
1. Try to use existing ZephyrEngine from zephyr-agent
2. Convert Next.js outputs to format expected by ZephyrEngine
3. Upload using existing infrastructure
4. Fallback to default adapter behavior if ZephyrEngine is not available

Requirements:
- zephyr-agent must be installed and available
- Environment variables must be set (ZEPHYR_ORG_ID, ZEPHYR_PROJECT_ID, ZEPHYR_API_KEY)
*/