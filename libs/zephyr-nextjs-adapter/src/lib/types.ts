/**
 * Type definitions for the Zephyr Next.js Adapter
 * 
 * These types match the exact interfaces from Next.js source code to ensure compatibility
 */

// Exact types from Next.js source code
export interface NextAdapter {
  name: string
  modifyConfig(
    config: NextConfigComplete
  ): Promise<NextConfigComplete> | NextConfigComplete
  onBuildComplete(ctx: {
    routes: {
      headers: Array<ManifestHeaderRoute>
      redirects: Array<ManifestRedirectRoute>
      rewrites: {
        beforeFiles: Array<ManifestRewriteRoute>
        afterFiles: Array<ManifestRewriteRoute>
        fallback: Array<ManifestRewriteRoute>
      }
      dynamicRoutes: Array<{}>
    }
    outputs: AdapterOutputs
  }): Promise<void> | void
}

// AdapterOutputs type from Next.js
export type AdapterOutputs = Array<{
  id: string
  fallbackID?: string
  runtime?: 'nodejs' | 'edge'
  pathname: string
  allowQuery?: string[]
  config?: {
    maxDuration?: number
    expiration?: number
    revalidate?: number
  }
  assets?: Record<string, string>
  filePath: string
  type: RouteType
}>

// For backward compatibility
export type AdapterOutput = AdapterOutputs[0]

// RouteType enum from Next.js source
export enum RouteType {
  /**
   * `PAGES` represents all the React pages that are under `pages/`.
   */
  PAGES = 'PAGES',
  /**
   * `PAGES_API` represents all the API routes under `pages/api/`.
   */
  PAGES_API = 'PAGES_API',
  /**
   * `APP_PAGE` represents all the React pages that are under `app/` with the
   * filename of `page.{j,t}s{,x}`.
   */
  APP_PAGE = 'APP_PAGE',
  /**
   * `APP_ROUTE` represents all the API routes and metadata routes that are under `app/` with the
   * filename of `route.{j,t}s{,x}`.
   */
  APP_ROUTE = 'APP_ROUTE',
  /**
   * `STATIC_FILE` represents a static file (ie /_next/static)
   */
  STATIC_FILE = 'STATIC_FILE',
  
  MIDDLEWARE = 'MIDDLEWARE'
}

// Next.js config interface
export interface NextConfigComplete {
  experimental?: {
    adapterPath?: string
    esmExternals?: boolean
    serverComponentsExternalPackages?: string[]
    [key: string]: any
  }
  output?: 'standalone' | 'export'
  webpack?: (config: any, options: any) => any
  [key: string]: any
}

// Manifest route types
export type ManifestBuiltRoute = {
  /**
   * The route pattern used to match requests for this route.
   */
  regex: string
}

export interface Rewrite {
  source: string
  destination: string
  basePath?: false
  locale?: false
  has?: RouteHas[]
  missing?: RouteHas[]
}

export interface Redirect {
  source: string
  destination: string
  permanent?: boolean
  statusCode?: number
  basePath?: false
  locale?: false
  has?: RouteHas[]
  missing?: RouteHas[]
}

export interface Header {
  source: string
  headers: { key: string; value: string }[]
  basePath?: false
  locale?: false
  has?: RouteHas[]
  missing?: RouteHas[]
}

export type ManifestRewriteRoute = ManifestBuiltRoute & Rewrite
export type ManifestRedirectRoute = ManifestBuiltRoute & Redirect
export type ManifestHeaderRoute = ManifestBuiltRoute & Header

// Legacy types for backward compatibility
export interface HeaderRoute {
  source: string
  headers: Record<string, string>
  has?: RouteHas[]
  missing?: RouteHas[]
}

export interface RedirectRoute {
  source: string
  destination: string
  permanent?: boolean
  statusCode?: number
  has?: RouteHas[]
  missing?: RouteHas[]
}

export interface RewriteRoute {
  source: string
  destination: string
  has?: RouteHas[]
  missing?: RouteHas[]
}

export interface DynamicRoute {
  page: string
  regex: string
}

// Build context for legacy compatibility
export interface BuildContext {
  routes: {
    headers: Array<HeaderRoute>
    redirects: Array<RedirectRoute>
    rewrites: {
      beforeFiles: Array<RewriteRoute>
      afterFiles: Array<RewriteRoute>
      fallback: Array<RewriteRoute>
    }
    dynamicRoutes?: Array<DynamicRoute>
  }
  outputs: Array<AdapterOutput>
}

export interface HeaderRoute {
  source: string
  headers: Record<string, string>
  has?: RouteHas[]
  missing?: RouteHas[]
}

export interface RedirectRoute {
  source: string
  destination: string
  permanent?: boolean
  statusCode?: number
  has?: RouteHas[]
  missing?: RouteHas[]
}

export interface RewriteRoute {
  source: string
  destination: string
  has?: RouteHas[]
  missing?: RouteHas[]
}

export interface DynamicRoute {
  page: string
  regex: string
}

export type RouteHas =
  | {
      type: string
      key: string
      value?: string
    }
  | {
      type: 'host'
      key?: undefined
      value: string
    }

// Zephyr-specific types
export interface ZephyrConfig {
  orgId?: string
  projectId?: string
  apiKey?: string
  environment?: string
  buildId?: string
  enableModuleFederation?: boolean
  enableEdgeWorkers?: boolean
  // Auto-discovered metadata
  gitInfo?: {
    name?: string
    email?: string
    branch?: string
    commit?: string
    tags?: string[]
  }
  packageInfo?: {
    name: string
    version: string
  }
}

export interface ZephyrAdapterConfig {
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
  onUploadStart?: (snapshot: ZephyrSnapshot) => Promise<void> | void
  onUploadComplete?: (result: UploadResult) => Promise<void> | void
}

export interface ZephyrAssets {
  staticAssets: Map<string, ZephyrAssetInfo>
  serverFunctions: Map<string, ZephyrAssetInfo>
  edgeFunctions: Map<string, ZephyrAssetInfo>
  prerenderedPages: Map<string, ZephyrAssetInfo>
  manifests: Map<string, ZephyrAssetInfo>
  publicAssets: Map<string, ZephyrAssetInfo>
}

export interface ZephyrAssetInfo {
  id: string
  pathname: string
  filePath: string
  runtime?: 'nodejs' | 'edge'
  type: RouteType
  config?: {
    maxDuration?: number
    expiration?: number
    revalidate?: number
  }
  assets: Record<string, string>
  fallbackID?: string
}

export interface ZephyrSnapshot {
  id: string
  timestamp: string
  environment: string
  framework: 'nextjs'
  metadata: {
    totalOutputs: number
    hasMiddleware: boolean
    hasAPIRoutes: boolean
    hasSSR: boolean
    staticAssetsCount: number
    serverFunctionsCount: number
    edgeFunctionsCount: number
  }
  routes: BuildContext['routes']
  deploymentTargets: {
    cdn: {
      assets: ZephyrAssetInfo[]
      publicAssets: ZephyrAssetInfo[]
    }
    edge: {
      functions: ZephyrAssetInfo[]
    }
    server: {
      functions: ZephyrAssetInfo[]
    }
    manifests: ZephyrAssetInfo[]
  }
}

export interface UploadResult {
  success: boolean
  buildId: string
  timestamp: string
  uploadedAssets: number
  errors?: string[]
}

export interface DeploymentTarget {
  type: 'cdn' | 'edge' | 'server'
  assets: ZephyrAssetInfo[]
}

// Zephyr Engine integration types (for compatibility with existing infrastructure)
export interface ZeBuildAssetsMap {
  [key: string]: {
    path: string
    extname: string
    hash: string
    size: number
    buffer: Buffer | string
  }
}