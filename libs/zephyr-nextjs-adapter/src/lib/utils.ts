/**
 * Utility functions for the Zephyr Next.js Adapter
 */

import type { ZephyrConfig, RouteType, AdapterOutput } from './types'

/**
 * Get Zephyr configuration using the same auto-discovery approach as other plugins
 * This mirrors the pattern used in zephyr-agent for automatic git and package.json detection
 */
export async function getZephyrConfig(): Promise<ZephyrConfig> {
  try {
    // Try to import and use existing Zephyr infrastructure for auto-discovery
    const { ZephyrEngine } = await import('zephyr-agent')
    
    // Create a temporary ZephyrEngine instance to access the auto-discovery
    const tempEngine = await ZephyrEngine.create({
      context: process.cwd(),
      builder: 'unknown'
    })
    
    return {
      orgId: tempEngine.applicationProperties.org,
      projectId: tempEngine.applicationProperties.project,
      // API key still comes from environment or auth system
      apiKey: process.env['ZEPHYR_API_KEY'],
      environment: process.env['NODE_ENV'] || 'development',
      buildId: `nextjs-${tempEngine.applicationProperties.name}-${tempEngine.applicationProperties.version}-${Date.now()}`,
      enableModuleFederation: process.env['ZEPHYR_MODULE_FEDERATION'] === 'true',
      enableEdgeWorkers: process.env['ZEPHYR_EDGE_WORKERS'] !== 'false',
      // Additional auto-discovered metadata
      gitInfo: tempEngine.gitProperties.git,
      packageInfo: {
        name: tempEngine.npmProperties.name,
        version: tempEngine.npmProperties.version
      }
    }
  } catch (error) {
    // Fallback to environment variables if auto-discovery fails
    return {
      orgId: process.env['ZEPHYR_ORG_ID'],
      projectId: process.env['ZEPHYR_PROJECT_ID'],
      apiKey: process.env['ZEPHYR_API_KEY'],
      environment: process.env['NODE_ENV'] || 'development',
      buildId: `nextjs-build-${Date.now()}`,
      enableModuleFederation: process.env['ZEPHYR_MODULE_FEDERATION'] === 'true',
      enableEdgeWorkers: process.env['ZEPHYR_EDGE_WORKERS'] !== 'false'
    }
  }
}

/**
 * Create a logger with a specific context
 */
export function createLogger(context: string) {
  const isDebug = process.env['ZEPHYR_DEBUG'] === 'true' || process.env['DEBUG']?.includes('zephyr')
  
  return {
    info: (message: string, ...args: any[]) => {
      console.log(message, ...args)
    },
    warn: (message: string, ...args: any[]) => {
      console.warn(message, ...args)
    },
    error: (message: string, ...args: any[]) => {
      console.error(message, ...args)
    },
    debug: (message: string, ...args: any[]) => {
      if (isDebug) {
        console.log(`[DEBUG:${context}]`, message, ...args)
      }
    }
  }
}

/**
 * Determine the appropriate Zephyr deployment target for an output
 */
export function determineDeploymentTarget(output: AdapterOutput): 'cdn' | 'edge' | 'server' {
  switch (output.type) {
    case 'STATIC_FILE':
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
 * Check if an output is compatible with module federation
 */
export function isModuleFederationCompatible(output: AdapterOutput): boolean {
  // Static assets and certain types of pages can be federated
  return ['STATIC_FILE', 'APP_PAGE', 'PAGES'].includes(output.type)
}

/**
 * Check if an output should be cached by CDN
 */
export function isCacheable(output: AdapterOutput): boolean {
  // Static assets are cacheable, dynamic content is not
  return output.type === 'STATIC_FILE'
}

/**
 * Convert Map to Array for JSON serialization
 */
export function convertMapToArray<T>(map: Map<string, T>): T[] {
  return Array.from(map.values())
}

/**
 * Check if output is a public asset (from public folder)
 */
export function isPublicAsset(output: AdapterOutput): boolean {
  return output.type === 'STATIC_FILE' && 
         !output.pathname.startsWith('/_next/') &&
         !output.pathname.startsWith('/api/')
}

/**
 * Check if output is a static Next.js asset
 */
export function isNextJSStaticAsset(output: AdapterOutput): boolean {
  return output.type === 'STATIC_FILE' && 
         output.pathname.startsWith('/_next/static/')
}

/**
 * Generate a unique asset ID from output
 */
export function generateAssetId(output: AdapterOutput): string {
  return output.id || `${output.type}-${output.pathname.replace(/[^a-zA-Z0-9]/g, '-')}`
}

/**
 * Validate required Zephyr configuration
 * With auto-discovery, we only require API key as everything else is auto-detected
 */
export function validateZephyrConfig(config: ZephyrConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  
  // API key is still required for authentication
  if (!config.apiKey) {
    errors.push('ZEPHYR_API_KEY is required (or use `zephyr login` for token-based auth)')
  }
  
  // With auto-discovery, org and project should be available from git
  if (!config.orgId) {
    errors.push('Organization not found - ensure you are in a git repository with remote origin')
  }
  
  if (!config.projectId) {
    errors.push('Project not found - ensure you are in a git repository with remote origin')
  }
  
  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Create a delay for rate limiting or simulation
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Get file size in a human readable format
 */
export async function getFileSize(filePath: string): Promise<string> {
  try {
    const fs = await import('fs/promises')
    const stats = await fs.stat(filePath)
    const bytes = stats.size
    
    if (bytes === 0) return '0 B'
    
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  } catch {
    return 'unknown'
  }
}

/**
 * Calculate a simple hash for build identification
 */
export function calculateBuildHash(data: any): string {
  const str = JSON.stringify(data)
  let hash = 0
  
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  
  return Math.abs(hash).toString(16)
}

/**
 * Filter sensitive information from logs
 */
export function sanitizeForLogging(obj: any): any {
  const sensitive = ['apiKey', 'token', 'password', 'secret']
  
  if (typeof obj !== 'object' || obj === null) {
    return obj
  }
  
  if (Array.isArray(obj)) {
    return obj.map(sanitizeForLogging)
  }
  
  const sanitized: any = {}
  
  for (const [key, value] of Object.entries(obj)) {
    if (sensitive.some(s => key.toLowerCase().includes(s))) {
      sanitized[key] = '[REDACTED]'
    } else if (typeof value === 'object') {
      sanitized[key] = sanitizeForLogging(value)
    } else {
      sanitized[key] = value
    }
  }
  
  return sanitized
}