/** TypeScript types for Next.js deployment structures */

// ============================================================================
// Next.js Manifest Types
// ============================================================================

/** Parsed routes-manifest.json structure */
export interface RoutesManifest {
  version: number;
  basePath: string;
  redirects: Redirect[];
  rewrites?:
    | Rewrite[]
    | { beforeFiles?: Rewrite[]; afterFiles?: Rewrite[]; fallback?: Rewrite[] };
  headers: Header[];
  dynamicRoutes: DynamicRoute[];
  staticRoutes: StaticRoute[];
  dataRoutes?: DataRoute[];
  i18n?: I18nConfig;
  rsc?: RscConfig;
}

export interface Redirect {
  source: string;
  destination: string;
  statusCode?: number;
  permanent?: boolean;
  regex: string;
}

export interface Rewrite {
  source: string;
  destination: string;
  regex: string;
  has?: RouteHas[];
}

export interface Header {
  source: string;
  headers: Array<{ key: string; value: string }>;
  regex: string;
}

export interface DynamicRoute {
  page: string;
  regex: string;
  routeKeys?: Record<string, string>;
  namedRegex?: string;
}

export interface StaticRoute {
  page: string;
  regex: string;
  routeKeys?: Record<string, string>;
  namedRegex?: string;
}

export interface DataRoute {
  page: string;
  routeKeys?: Record<string, string>;
  dataRouteRegex: string;
  namedDataRouteRegex?: string;
}

export interface RouteHas {
  type: 'header' | 'query' | 'cookie' | 'host';
  key: string;
  value?: string;
}

export interface I18nConfig {
  locales: string[];
  defaultLocale: string;
  domains?: Array<{
    domain: string;
    defaultLocale: string;
    locales?: string[];
  }>;
}

export interface RscConfig {
  header: string;
  varyHeader: string;
  contentTypeHeader: string;
  prefetchHeader?: string;
}

/** Parsed prerender-manifest.json structure */
export interface PrerenderManifest {
  version: number;
  routes: Record<string, PrerenderRoute>;
  dynamicRoutes: Record<string, PrerenderDynamicRoute>;
  notFoundRoutes: string[];
  preview: PreviewConfig;
}

export interface PrerenderRoute {
  initialRevalidateSeconds: number | false;
  srcRoute: string | null;
  dataRoute: string | null;
  initialStatus?: number;
  initialHeaders?: Record<string, string>;
}

export interface PrerenderDynamicRoute {
  routeRegex: string;
  dataRoute: string;
  fallback: string | false | null;
  dataRouteRegex: string;
}

export interface PreviewConfig {
  previewModeId: string;
  previewModeSigningKey: string;
  previewModeEncryptionKey: string;
}

/** Parsed middleware-manifest.json structure */
export interface MiddlewareManifest {
  version: number;
  sortedMiddleware: string[];
  middleware: Record<string, MiddlewareInfo>;
  functions?: Record<string, EdgeFunctionInfo>;
}

export interface MiddlewareInfo {
  env: string[];
  files: string[];
  name: string;
  page: string;
  matchers: MiddlewareMatcher[];
  wasm?: Array<{ filePath: string; name: string }>;
  assets?: Array<{ filePath: string; name: string }>;
}

export interface EdgeFunctionInfo {
  env: string[];
  files: string[];
  name: string;
  page: string;
  matchers?: MiddlewareMatcher[];
  regions?: string | string[];
  wasm?: Array<{ filePath: string; name: string }>;
  assets?: Array<{ filePath: string; name: string }>;
}

export interface MiddlewareMatcher {
  regexp: string;
  originalSource: string;
  locale?: false;
  has?: RouteHas[];
}

/** Parsed functions-config-manifest.json structure */
export interface FunctionsConfigManifest {
  version: number;
  functions: Record<string, FunctionConfig>;
}

export interface FunctionConfig {
  runtime?: 'edge' | 'nodejs';
  memory?: number;
  maxDuration?: number;
  regions?: string[];
}

/** Parsed required-server-files.json structure */
export interface RequiredServerFiles {
  version: number;
  config: NextConfig;
  appDir: string;
  relativeAppDir?: string;
  files: string[];
  ignore: string[];
}

export interface NextConfig {
  env?: Record<string, string>;
  webpack?: any;
  webpackDevMiddleware?: any;
  eslint?: any;
  typescript?: any;
  distDir?: string;
  cleanDistDir?: boolean;
  assetPrefix?: string;
  configOrigin?: string;
  useFileSystemPublicRoutes?: boolean;
  generateEtags?: boolean;
  pageExtensions?: string[];
  poweredByHeader?: boolean;
  compress?: boolean;
  analyticsId?: string;
  images?: any;
  devIndicators?: any;
  onDemandEntries?: any;
  amp?: any;
  basePath?: string;
  sassOptions?: any;
  trailingSlash?: boolean;
  i18n?: I18nConfig;
  productionBrowserSourceMaps?: boolean;
  optimizeFonts?: boolean;
  excludeDefaultMomentLocales?: boolean;
  serverRuntimeConfig?: Record<string, any>;
  publicRuntimeConfig?: Record<string, any>;
  reactStrictMode?: boolean;
  httpAgentOptions?: any;
  experimental?: any;
  output?: 'standalone' | 'export';
  outputFileTracingRoot?: string;
}

/** Parsed .nft.json structure */
export interface NftFile {
  version: number;
  files: string[];
}

// ============================================================================
// Deployment Types
// ============================================================================

/** Route type classification */
export enum RouteType {
  STATIC_HTML = 'static-html', // Pre-rendered at build (index.html)
  SERVERLESS_SSR = 'serverless-ssr', // Dynamic SSR (page.js with no prerender)
  SERVERLESS_API = 'serverless-api', // API routes (route.js)
  STATIC_ASSET = 'static-asset', // JS/CSS/images
  MIDDLEWARE = 'middleware', // Edge middleware
  EDGE_FUNCTION = 'edge-function', // Edge runtime function
  ISR = 'isr', // Incremental Static Regeneration
}

/** Information about a single route */
export interface RouteInfo {
  /** Route path (e.g., "/", "/api/users", "/blog/[slug]") */
  path: string;

  /** Route type classification */
  type: RouteType;

  /** Entry point file in .next/server (e.g., "app/page.js") */
  entryPoint: string | null;

  /** Regex pattern for matching (from routes-manifest) */
  regex: string;

  /** Runtime type */
  runtime: 'nodejs' | 'edge';

  /** ISR revalidation seconds (if ISR route) */
  revalidate?: number | false;

  /** Whether this is a dynamic route */
  isDynamic: boolean;

  /** Route keys for dynamic segments */
  routeKeys?: Record<string, string>;
}

/** Bundled serverless function ready for deployment */
export interface ServerlessFunction {
  /** Route path this function handles */
  route: string;

  /** Function entry point (relative to bundle root) */
  entryPoint: string;

  /** All files needed for this function (from .nft.json) */
  dependencies: string[];

  /** Runtime type */
  runtime: 'nodejs' | 'edge';

  /** Function bundle directory (temp location) */
  bundleDir: string;

  /** Route matching regex */
  regex: string;

  /** Whether this is a dynamic route */
  isDynamic: boolean;

  /** Route keys for dynamic segments */
  routeKeys?: Record<string, string>;
}

/** Complete parsed Next.js manifests */
export interface NextJsManifests {
  routes: RoutesManifest;
  prerender: PrerenderManifest;
  middleware: MiddlewareManifest | null;
  functionsConfig: FunctionsConfigManifest | null;
  requiredServerFiles: RequiredServerFiles;
  buildId: string;
}

/** Complete deployment plan */
export interface DeploymentPlan {
  /** Pre-rendered HTML and static assets */
  staticFiles: Map<string, string>; // uploadPath -> localPath

  /** Serverless functions to deploy */
  serverlessFunctions: ServerlessFunction[];

  /** Edge functions (middleware, edge runtime routes) */
  edgeFunctions: ServerlessFunction[];

  /** Next.js configuration */
  config: NextConfig;

  /** Build ID */
  buildId: string;

  /** Route information */
  routes: RouteInfo[];
}

// ============================================================================
// Command Options
// ============================================================================

/** Options for deploy-nextjs command */
export interface DeployNextjsOptions {
  /** Directory containing Next.js project (default: current) */
  directory: string;

  /** Current working directory */
  cwd: string;

  /** Verbose logging */
  verbose?: boolean;

  /** Target platform */
  target?: 'web' | 'ios' | 'android';
}
