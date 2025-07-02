export interface ZephyrNextJSPluginOptions {
  // Optional flag to wait for index.html processing (for SPA mode)
  wait_for_index_html?: boolean;
}

// Server function asset type
export interface ZephyrServerAsset {
  // Basic asset properties
  path: string;
  hash: string;
  size: number;
  content: string | Buffer;

  // Server function specific properties
  type: 'api-route' | 'server-action' | 'page-ssr' | 'middleware' | 'edge-function';
  runtime: 'nodejs' | 'edge';
  routes: string[]; // Route patterns this function handles
  dependencies?: string[]; // Required dependencies
  environment?: Record<string, string>; // Environment variables needed

  // NextJS specific metadata
  nextjsMetadata?: {
    buildId: string;
    routeType: 'app' | 'pages'; // App Router vs Pages Router
    dynamic?: boolean; // Is this a dynamic route
    middleware?: boolean; // Is this middleware
  };
}

// Enhanced snapshot format for server functions
export interface ZephyrNextJSSnapshot {
  // Existing static assets
  staticAssets: Array<{
    id: string;
    filepath: string;
    headers?: Record<string, string>;
    compressed?: boolean;
  }>;
  staticAssetsMap: Record<string, any>;

  // New server function assets
  serverFunctions?: ZephyrServerAsset[];
  serverFunctionsMap?: Record<string, ZephyrServerAsset>;

  // NextJS routing and metadata
  routeManifest?: NextJSRouteManifest;
  buildManifest?: NextJSBuildManifest;
  middleware?: ZephyrServerAsset[];

  // Build metadata
  buildId: string;
  nextjsVersion?: string;
  buildTime: number;
}

// NextJS route manifest types
export interface NextJSRouteManifest {
  version: number;
  pages: Record<string, string>; // Page routes
  apiRoutes: Record<string, string>; // API routes
  dynamicRoutes?: NextJSDynamicRoute[]; // Dynamic route definitions
  rewrites?: NextJSRewrite[]; // URL rewrites
  redirects?: NextJSRedirect[]; // URL redirects
}

export interface NextJSDynamicRoute {
  page: string;
  regex: string;
  routeKeys: Record<string, string>;
  namedRegex?: string;
}

export interface NextJSRewrite {
  source: string;
  destination: string;
  regex?: string;
}

export interface NextJSRedirect {
  source: string;
  destination: string;
  permanent?: boolean;
  statusCode?: number;
}

// NextJS build manifest types
export interface NextJSBuildManifest {
  devFiles: string[];
  ampDevFiles: string[];
  polyfillFiles: string[];
  lowPriorityFiles: string[];
  rootMainFiles: string[];
  pages: Record<string, string[]>; // Page to chunk mapping
  ampFirstPages: string[];
}
