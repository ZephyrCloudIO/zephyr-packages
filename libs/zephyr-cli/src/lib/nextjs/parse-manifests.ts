/** Utilities for parsing Next.js manifest files */

import * as path from 'path';
import { ZephyrError, ZeErrors } from 'zephyr-agent';
import {
  RoutesManifest,
  PrerenderManifest,
  MiddlewareManifest,
  FunctionsConfigManifest,
  RequiredServerFiles,
  NextJsManifests,
  RouteInfo,
  RouteType,
} from './types';
import {
  readJsonFile,
  fileExists,
  getBuildId,
  isDynamicRoute,
  getOutputFileTracingRoot,
} from './utils';

/**
 * Parse all Next.js manifest files from .next directory
 *
 * @param nextDir - Path to .next directory
 * @returns Parsed manifests object
 */
export function parseAllManifests(nextDir: string): NextJsManifests {
  const routesManifest = parseRoutesManifest(nextDir);
  const prerenderManifest = parsePrerenderManifest(nextDir);
  const middlewareManifest = parseMiddlewareManifest(nextDir);
  const functionsConfigManifest = parseFunctionsConfigManifest(nextDir);
  const requiredServerFiles = parseRequiredServerFiles(nextDir);
  const buildId = getBuildId(nextDir);

  return {
    routes: routesManifest,
    prerender: prerenderManifest,
    middleware: middlewareManifest,
    functionsConfig: functionsConfigManifest,
    requiredServerFiles,
    buildId,
  };
}

/**
 * Parse routes-manifest.json
 *
 * @param nextDir - Path to .next directory
 * @returns Parsed routes manifest
 */
export function parseRoutesManifest(nextDir: string): RoutesManifest {
  const manifestPath = path.join(nextDir, 'routes-manifest.json');
  return readJsonFile<RoutesManifest>(manifestPath);
}

/**
 * Parse prerender-manifest.json
 *
 * @param nextDir - Path to .next directory
 * @returns Parsed prerender manifest
 */
export function parsePrerenderManifest(nextDir: string): PrerenderManifest {
  const manifestPath = path.join(nextDir, 'prerender-manifest.json');
  return readJsonFile<PrerenderManifest>(manifestPath);
}

/**
 * Parse middleware-manifest.json (may not exist)
 *
 * @param nextDir - Path to .next directory
 * @returns Parsed middleware manifest or null if not found
 */
export function parseMiddlewareManifest(nextDir: string): MiddlewareManifest | null {
  const manifestPath = path.join(nextDir, 'server', 'middleware-manifest.json');
  if (!fileExists(manifestPath)) {
    return null;
  }
  return readJsonFile<MiddlewareManifest>(manifestPath);
}

/**
 * Parse functions-config-manifest.json (may not exist)
 *
 * @param nextDir - Path to .next directory
 * @returns Parsed functions config manifest or null if not found
 */
export function parseFunctionsConfigManifest(
  nextDir: string
): FunctionsConfigManifest | null {
  const manifestPath = path.join(nextDir, 'server', 'functions-config-manifest.json');
  if (!fileExists(manifestPath)) {
    return null;
  }
  return readJsonFile<FunctionsConfigManifest>(manifestPath);
}

/**
 * Parse required-server-files.json
 *
 * @param nextDir - Path to .next directory
 * @returns Parsed required server files
 */
export function parseRequiredServerFiles(nextDir: string): RequiredServerFiles {
  const manifestPath = path.join(nextDir, 'required-server-files.json');
  return readJsonFile<RequiredServerFiles>(manifestPath);
}

/**
 * Classify all routes from manifests
 *
 * @param nextDir - Path to .next directory
 * @param manifests - Parsed Next.js manifests
 * @returns Array of classified route information
 */
export function classifyRoutes(nextDir: string, manifests: NextJsManifests): RouteInfo[] {
  const routes: RouteInfo[] = [];
  const { routes: routesManifest, prerender, functionsConfig, middleware } = manifests;

  // Process static routes (from routes-manifest.json)
  for (const staticRoute of routesManifest.staticRoutes || []) {
    const routePath = staticRoute.page;
    const routeInfo = classifySingleRoute(
      nextDir,
      routePath,
      staticRoute.regex,
      false,
      staticRoute.routeKeys,
      prerender,
      functionsConfig,
      middleware
    );
    routes.push(routeInfo);
  }

  // Process dynamic routes (from routes-manifest.json)
  for (const dynamicRoute of routesManifest.dynamicRoutes || []) {
    const routePath = dynamicRoute.page;
    const routeInfo = classifySingleRoute(
      nextDir,
      routePath,
      dynamicRoute.regex,
      true,
      dynamicRoute.routeKeys,
      prerender,
      functionsConfig,
      middleware
    );
    routes.push(routeInfo);
  }

  return routes;
}

/**
 * Classify a single route
 *
 * @param nextDir - Path to .next directory
 * @param routePath - Route path (e.g., "/", "/api/users")
 * @param regex - Regex pattern for matching
 * @param isDynamic - Whether route is dynamic
 * @param routeKeys - Route keys for dynamic segments
 * @param prerender - Prerender manifest
 * @param functionsConfig - Functions config manifest
 * @param middleware - Middleware manifest (for edge function detection)
 * @returns Classified route information
 */
function classifySingleRoute(
  nextDir: string,
  routePath: string,
  regex: string,
  isDynamic: boolean,
  routeKeys: Record<string, string> | undefined,
  prerender: PrerenderManifest,
  functionsConfig: FunctionsConfigManifest | null,
  middleware: MiddlewareManifest | null
): RouteInfo {
  // Determine route type based on prerender status and location
  let type: RouteType;
  let revalidate: number | false | undefined;
  let runtime: 'nodejs' | 'edge' = 'nodejs';

  // Check if route is pre-rendered (static or ISR)
  const prerenderRoute = prerender.routes[routePath];
  if (prerenderRoute) {
    if (prerenderRoute.initialRevalidateSeconds === false) {
      // Purely static
      type = RouteType.STATIC_HTML;
    } else {
      // ISR (Incremental Static Regeneration)
      type = RouteType.ISR;
      revalidate = prerenderRoute.initialRevalidateSeconds;
    }
  } else {
    // Not pre-rendered, so it's a serverless route
    if (routePath.startsWith('/api/')) {
      type = RouteType.SERVERLESS_API;
    } else {
      type = RouteType.SERVERLESS_SSR;
    }
  }

  // Check for runtime configuration
  // First check functions-config-manifest.json
  if (functionsConfig?.functions[routePath]) {
    const config = functionsConfig.functions[routePath];
    if (config.runtime === 'edge') {
      runtime = 'edge';
      type = RouteType.EDGE_FUNCTION;
    }
  }

  // Also check middleware-manifest.json for edge functions
  // This is where Next.js puts edge runtime information when using `export const runtime = 'edge'`
  let edgeFunctionKey: string | null = null;
  if (middleware?.functions) {
    // First try direct path match
    if (middleware.functions[routePath]) {
      runtime = 'edge';
      type = RouteType.EDGE_FUNCTION;
      edgeFunctionKey = routePath;
    } else {
      // App Router API routes may have /route suffix in the key
      // Search by matcher patterns instead
      for (const [key, funcInfo] of Object.entries(middleware.functions)) {
        if (funcInfo.matchers?.some(m => m.originalSource === routePath)) {
          runtime = 'edge';
          type = RouteType.EDGE_FUNCTION;
          edgeFunctionKey = key;
          break;
        }
      }
    }
  }

  // Determine entry point in .next/server
  const entryPoint = getServerEntryPoint(nextDir, routePath, runtime, edgeFunctionKey, middleware);

  return {
    path: routePath,
    type,
    entryPoint,
    regex,
    runtime,
    revalidate,
    isDynamic,
    routeKeys,
  };
}

/**
 * Get the server entry point file for a route
 *
 * @param nextDir - Path to .next directory
 * @param routePath - Route path
 * @param runtime - Runtime type (nodejs or edge)
 * @param edgeFunctionKey - Key in middleware-manifest.json for edge functions
 * @param middleware - Middleware manifest
 * @returns Relative path to entry point file, or null if not found
 */
function getServerEntryPoint(
  nextDir: string,
  routePath: string,
  runtime: 'nodejs' | 'edge' = 'nodejs',
  edgeFunctionKey: string | null = null,
  middleware: MiddlewareManifest | null = null
): string | null {
  const serverDir = path.join(nextDir, 'server');

  // For edge functions, use the files array from middleware-manifest.json
  if (runtime === 'edge' && edgeFunctionKey && middleware?.functions?.[edgeFunctionKey]) {
    const edgeFunc = middleware.functions[edgeFunctionKey];
    // Edge functions have their entry point in the files array
    // For Turbopack (Next.js 16+), we need to load all files in order
    // The last file (edge-wrapper) sets up _ENTRIES global
    if (edgeFunc.files && edgeFunc.files.length > 0) {
      // Look for the edge wrapper file (turbopack-*_edge-wrapper_*.js or similar)
      // This should be loaded last as it depends on other chunks
      const edgeWrapperFile = edgeFunc.files.find(f =>
        f.includes('edge-wrapper')
      );
      if (edgeWrapperFile) {
        // Return the wrapper file as the entry point
        // The bundler will copy all files from the middleware manifest
        return edgeWrapperFile.replace(/^server\//, '');
      }
      // Fallback: use the last file in the array
      const lastFile = edgeFunc.files[edgeFunc.files.length - 1];
      return lastFile.replace(/^server\//, '');
    }
  }

  // For App Router: routes are in server/app/
  // For Pages Router: routes are in server/pages/

  // Try App Router first
  let entryPoint = getAppRouterEntryPoint(serverDir, routePath);
  if (entryPoint) {
    return entryPoint;
  }

  // Try Pages Router
  entryPoint = getPagesRouterEntryPoint(serverDir, routePath);
  if (entryPoint) {
    return entryPoint;
  }

  console.error(
    `[ze-cli] Warning: Could not find server entry point for route: ${routePath}`
  );
  return null;
}

/**
 * Get App Router entry point
 *
 * @param serverDir - Path to .next/server directory
 * @param routePath - Route path
 * @returns Relative entry point path or null
 */
function getAppRouterEntryPoint(serverDir: string, routePath: string): string | null {
  // App Router structure:
  // /          -> app/page.js (or app/(group)/page.js)
  // /about     -> app/about/page.js (or app/(group)/about/page.js)
  // /api/users -> app/api/users/route.js (or app/(group)/api/users/route.js)

  // Next.js uses route groups (folders wrapped in parentheses) which don't affect the URL path
  // We need to search for the file considering these route groups

  const fileName = routePath.startsWith('/api/') ? 'route.js' : 'page.js';
  const appDir = path.join(serverDir, 'app');

  if (!fileExists(appDir)) {
    return null;
  }

  // For root route
  if (routePath === '/') {
    const found = findFileInDirectory(appDir, [], fileName);
    return found ? `app/${found}` : null;
  }

  // Split the route path into segments
  const segments = routePath.slice(1).split('/').filter((p) => p);

  // Try to find the file considering route groups
  const found = findFileInDirectory(appDir, segments, fileName);
  return found ? `app/${found}` : null;
}

/**
 * Recursively search for a file in a directory, considering route groups
 *
 * @param currentDir - Current directory to search
 * @param remainingSegments - Remaining path segments to match
 * @param fileName - Target file name (page.js or route.js)
 * @returns Relative path from app directory, or null if not found
 */
function findFileInDirectory(
  currentDir: string,
  remainingSegments: string[],
  fileName: string
): string | null {
  const fs = require('fs');

  // Base case: no more segments, look for the file
  if (remainingSegments.length === 0) {
    const targetPath = path.join(currentDir, fileName);
    if (fileExists(targetPath)) {
      return fileName;
    }
    return null;
  }

  if (!fileExists(currentDir)) {
    return null;
  }

  const [nextSegment, ...restSegments] = remainingSegments;

  try {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const dirName = entry.name;

      // Check if this directory matches the next segment (exact match or route group)
      const isRouteGroup = dirName.startsWith('(') && dirName.endsWith(')');
      const isMatch = dirName === nextSegment;

      if (isMatch) {
        // Exact match - continue down this path
        const subPath = path.join(currentDir, dirName);
        const result = findFileInDirectory(subPath, restSegments, fileName);
        if (result) {
          return path.join(dirName, result);
        }
      } else if (isRouteGroup) {
        // Route group - search inside without consuming a segment
        const subPath = path.join(currentDir, dirName);
        const result = findFileInDirectory(subPath, remainingSegments, fileName);
        if (result) {
          return path.join(dirName, result);
        }
      }
    }
  } catch (error) {
    return null;
  }

  return null;
}

/**
 * Get Pages Router entry point
 *
 * @param serverDir - Path to .next/server directory
 * @param routePath - Route path
 * @returns Relative entry point path or null
 */
function getPagesRouterEntryPoint(serverDir: string, routePath: string): string | null {
  // Pages Router structure:
  // /          -> pages/index.js
  // /about     -> pages/about.js
  // /api/users -> pages/api/users.js

  let relPath: string;

  if (routePath === '/') {
    relPath = 'pages/index.js';
  } else {
    const pagePath = routePath.slice(1); // Remove leading '/'
    relPath = `pages/${pagePath}.js`;
  }

  const fullPath = path.join(serverDir, relPath);
  if (fileExists(fullPath)) {
    return relPath;
  }

  // Try with /index.js suffix (for directory-based pages)
  const indexPath = relPath.replace('.js', '/index.js');
  if (fileExists(path.join(serverDir, indexPath))) {
    return indexPath;
  }

  return null;
}

/**
 * Get all serverless routes that need to be deployed as functions
 *
 * @param routes - Classified routes
 * @returns Array of routes that need serverless deployment
 */
export function getServerlessRoutes(routes: RouteInfo[]): RouteInfo[] {
  return routes.filter(
    (route) =>
      route.type === RouteType.SERVERLESS_SSR ||
      route.type === RouteType.SERVERLESS_API ||
      route.type === RouteType.ISR
  );
}

/**
 * Get all edge function routes
 *
 * @param routes - Classified routes
 * @returns Array of routes that need edge deployment
 */
export function getEdgeRoutes(routes: RouteInfo[]): RouteInfo[] {
  return routes.filter(
    (route) =>
      route.type === RouteType.EDGE_FUNCTION || route.type === RouteType.MIDDLEWARE
  );
}

/**
 * Get all static routes (pre-rendered HTML)
 *
 * @param routes - Classified routes
 * @returns Array of static routes
 */
export function getStaticRoutes(routes: RouteInfo[]): RouteInfo[] {
  return routes.filter((route) => route.type === RouteType.STATIC_HTML);
}

/**
 * Get middleware information from manifest
 *
 * @param manifests - Parsed Next.js manifests
 * @returns Middleware info or null if no middleware
 */
export function getMiddlewareInfo(manifests: NextJsManifests): {
  files: string[];
  matchers: Array<{ regexp: string; originalSource: string }>;
} | null {
  if (!manifests.middleware || !manifests.middleware.sortedMiddleware.length) {
    return null;
  }

  // Get first middleware (usually there's only one)
  const middlewareName = manifests.middleware.sortedMiddleware[0];
  const middlewareInfo = manifests.middleware.middleware[middlewareName];

  if (!middlewareInfo) {
    return null;
  }

  return {
    files: middlewareInfo.files,
    matchers: middlewareInfo.matchers.map((m) => ({
      regexp: m.regexp,
      originalSource: m.originalSource,
    })),
  };
}
