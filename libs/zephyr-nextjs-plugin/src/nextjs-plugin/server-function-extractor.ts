import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, relative, extname } from 'path';
import { createHash } from 'crypto';
import type {
  ZephyrServerAsset,
  NextJSRouteManifest,
  NextJSBuildManifest,
  ZephyrNextJSPluginOptions,
} from '../types';

/**
 * NextJS Server Function Extractor
 *
 * Analyzes NextJS build output and extracts server functions, API routes, and other
 * server-side code for deployment to edge workers.
 */

export class NextJSServerFunctionExtractor {
  private buildPath: string;
  private buildId: string;
  private options: ZephyrNextJSPluginOptions;

  constructor(
    buildPath: string,
    buildId: string,
    options: ZephyrNextJSPluginOptions = {}
  ) {
    this.buildPath = buildPath;
    this.buildId = buildId;
    this.options = options;
  }

  /** Extract all server functions from NextJS build output */
  async extractServerFunctions(): Promise<{
    serverFunctions: ZephyrServerAsset[];
    routeManifest?: NextJSRouteManifest;
    buildManifest?: NextJSBuildManifest;
  }> {
    const serverFunctions: ZephyrServerAsset[] = [];

    // Always extract server functions for Next.js projects

    try {
      console.log('🔍 Extracting NextJS server functions from build...');

      // Extract API routes (Pages Router and App Router)
      const apiRoutes = await this.extractApiRoutes();
      serverFunctions.push(...apiRoutes);

      // Extract server actions (App Router)
      const serverActions = await this.extractServerActions();
      serverFunctions.push(...serverActions);

      // Extract middleware (always enabled for Next.js)
      const middleware = await this.extractMiddleware();
      serverFunctions.push(...middleware);

      // Extract SSR pages (if enabled)
      const ssrPages = await this.extractSSRPages();
      serverFunctions.push(...ssrPages);

      // Load NextJS manifests
      const routeManifest = this.loadRouteManifest();
      const buildManifest = this.loadBuildManifest();

      console.log(`✅ Extracted ${serverFunctions.length} server functions`);

      return {
        serverFunctions,
        routeManifest,
        buildManifest,
      };
    } catch (error) {
      console.error('❌ Error extracting server functions:', error);
      return { serverFunctions };
    }
  }

  /** Extract API routes from both Pages Router and App Router */
  private async extractApiRoutes(): Promise<ZephyrServerAsset[]> {
    const apiRoutes: ZephyrServerAsset[] = [];

    // Pages Router API routes: .next/server/pages/api/
    const pagesApiPath = join(this.buildPath, '.next', 'server', 'pages', 'api');
    if (existsSync(pagesApiPath)) {
      const pagesApiRoutes = this.extractFromDirectory(
        pagesApiPath,
        'api-route',
        'pages',
        '/api'
      );
      apiRoutes.push(...pagesApiRoutes);
    }

    // App Router API routes: .next/server/app/**/route.js
    const appServerPath = join(this.buildPath, '.next', 'server', 'app');
    if (existsSync(appServerPath)) {
      const appApiRoutes = this.extractAppRouterApiRoutes(appServerPath);
      apiRoutes.push(...appApiRoutes);
    }

    return apiRoutes;
  }

  /** Extract server actions from App Router */
  private async extractServerActions(): Promise<ZephyrServerAsset[]> {
    const serverActions: ZephyrServerAsset[] = [];

    // Server actions are typically in .next/server/app/ with action exports
    const appServerPath = join(this.buildPath, '.next', 'server', 'app');
    if (existsSync(appServerPath)) {
      const actions = this.extractFromDirectory(
        appServerPath,
        'server-action',
        'app',
        '',
        (content) => this.hasServerActions(content)
      );
      serverActions.push(...actions);
    }

    return serverActions;
  }

  /** Extract middleware from build output */
  private async extractMiddleware(): Promise<ZephyrServerAsset[]> {
    const middleware: ZephyrServerAsset[] = [];

    // Look for middleware in .next/server/
    const middlewarePath = join(this.buildPath, '.next', 'server', 'middleware.js');
    if (existsSync(middlewarePath)) {
      const asset = this.createServerAsset(
        middlewarePath,
        'middleware',
        'app',
        ['/*'] // Middleware typically handles all routes
      );
      if (asset) {
        middleware.push(asset);
      }
    }

    return middleware;
  }

  /** Extract SSR pages that need server-side rendering */
  private async extractSSRPages(): Promise<ZephyrServerAsset[]> {
    const ssrPages: ZephyrServerAsset[] = [];

    // Look for SSR pages in .next/server/pages/ (non-static)
    const pagesServerPath = join(this.buildPath, '.next', 'server', 'pages');
    if (existsSync(pagesServerPath)) {
      const pages = this.extractFromDirectory(
        pagesServerPath,
        'page-ssr',
        'pages',
        '',
        (content) => this.requiresSSR(content)
      );
      ssrPages.push(...pages);
    }

    return ssrPages;
  }

  /** Extract server functions from a directory recursively */
  private extractFromDirectory(
    dirPath: string,
    type: ZephyrServerAsset['type'],
    routeType: 'app' | 'pages',
    routePrefix = '',
    filter?: (content: string) => boolean
  ): ZephyrServerAsset[] {
    const assets: ZephyrServerAsset[] = [];

    if (!existsSync(dirPath)) {
      return assets;
    }

    const files = readdirSync(dirPath);

    for (const file of files) {
      const filePath = join(dirPath, file);
      const stat = statSync(filePath);

      if (stat.isDirectory()) {
        // Recurse into subdirectories
        const subAssets = this.extractFromDirectory(
          filePath,
          type,
          routeType,
          routePrefix,
          filter
        );
        assets.push(...subAssets);
      } else if (this.isServerFile(file)) {
        // Process server function files
        const asset = this.createServerAsset(
          filePath,
          type,
          routeType,
          undefined,
          filter
        );
        if (asset) {
          assets.push(asset);
        }
      }
    }

    return assets;
  }

  /** Extract App Router API routes (route.js files) */
  private extractAppRouterApiRoutes(appPath: string): ZephyrServerAsset[] {
    const apiRoutes: ZephyrServerAsset[] = [];

    const findRouteFiles = (dir: string, basePath = ''): void => {
      if (!existsSync(dir)) return;

      const files = readdirSync(dir);

      for (const file of files) {
        const filePath = join(dir, file);
        const stat = statSync(filePath);

        if (stat.isDirectory()) {
          findRouteFiles(filePath, join(basePath, file));
        } else if (file === 'route.js' || file === 'route.ts') {
          const routes = [`/api${basePath ? '/' + basePath.replace(/\\/g, '/') : ''}`];
          const asset = this.createServerAsset(filePath, 'api-route', 'app', routes);
          if (asset) {
            apiRoutes.push(asset);
          }
        }
      }
    };

    // Look for route.js files in app directory
    findRouteFiles(appPath);

    return apiRoutes;
  }

  /** Create a server asset from a file */
  private createServerAsset(
    filePath: string,
    type: ZephyrServerAsset['type'],
    routeType: 'app' | 'pages',
    routes?: string[],
    filter?: (content: string) => boolean
  ): ZephyrServerAsset | null {
    try {
      const content = readFileSync(filePath, 'utf-8');

      // Apply filter if provided
      if (filter && !filter(content)) {
        return null;
      }

      // Generate routes if not provided
      if (!routes) {
        routes = this.generateRoutesFromPath(filePath, routeType);
      }

      // Create hash
      const hash = createHash('sha256').update(content).update(filePath).digest('hex');

      const relativePath = relative(this.buildPath, filePath);

      return {
        path: relativePath,
        hash,
        size: Buffer.byteLength(content, 'utf-8'),
        content,
        type,
        runtime: 'edge', // Always use edge runtime for Next.js
        routes,
        nextjsMetadata: {
          buildId: this.buildId,
          routeType,
          dynamic: this.isDynamicRoute(filePath),
          middleware: type === 'middleware',
        },
      };
    } catch (error) {
      console.warn(`⚠️  Failed to process server asset ${filePath}:`, error);
      return null;
    }
  }

  /** Generate route patterns from file path */
  private generateRoutesFromPath(filePath: string, routeType: 'app' | 'pages'): string[] {
    const relativePath = relative(this.buildPath, filePath);

    if (routeType === 'pages') {
      // Pages Router: pages/api/users/[id].js -> /api/users/[id]
      const match = relativePath.match(/pages\/(.+)\.(js|ts)$/);
      if (match) {
        return [`/${match[1]}`];
      }
    } else {
      // App Router: app/api/users/[id]/route.js -> /api/users/[id]
      const match = relativePath.match(/app\/(.+)\/route\.(js|ts)$/);
      if (match) {
        return [`/${match[1]}`];
      }
    }

    return ['/'];
  }

  /** Check if file is a server function file */
  private isServerFile(filename: string): boolean {
    const ext = extname(filename);
    return (
      ['.js', '.ts', '.mjs'].includes(ext) &&
      !filename.endsWith('.d.ts') &&
      !filename.includes('.test.') &&
      !filename.includes('.spec.')
    );
  }

  /** Check if content contains server actions */
  private hasServerActions(content: string): boolean {
    return (
      content.includes('use server') ||
      content.includes('createAction') ||
      content.match(/export\s+(async\s+)?function\s+\w+\s*\(/) !== null
    );
  }

  /** Check if content requires SSR */
  private requiresSSR(content: string): boolean {
    return (
      content.includes('getServerSideProps') ||
      content.includes('getInitialProps') ||
      content.includes('generateMetadata')
    );
  }

  /** Check if route is dynamic (contains [...] or [param]) */
  private isDynamicRoute(filePath: string): boolean {
    return filePath.includes('[') && filePath.includes(']');
  }

  /** Load NextJS route manifest */
  private loadRouteManifest(): NextJSRouteManifest | undefined {
    try {
      const manifestPath = join(this.buildPath, '.next', 'routes-manifest.json');
      if (existsSync(manifestPath)) {
        const content = readFileSync(manifestPath, 'utf-8');
        return JSON.parse(content);
      }
    } catch (error) {
      console.warn('⚠️  Failed to load routes manifest:', error);
    }
    return undefined;
  }

  /** Load NextJS build manifest */
  private loadBuildManifest(): NextJSBuildManifest | undefined {
    try {
      const manifestPath = join(this.buildPath, '.next', 'build-manifest.json');
      if (existsSync(manifestPath)) {
        const content = readFileSync(manifestPath, 'utf-8');
        return JSON.parse(content);
      }
    } catch (error) {
      console.warn('⚠️  Failed to load build manifest:', error);
    }
    return undefined;
  }
}
