import type { ZephyrEngine } from 'zephyr-agent';
import { logFn, ze_log, ZephyrError } from 'zephyr-agent';
import type { Source } from 'zephyr-edge-contract';
import type { XStats, XStatsCompilation } from 'zephyr-xpack-internal';
import type { 
  ZephyrNextJSSnapshot, 
  ZephyrServerAsset, 
  NextJSBuildManifest, 
  NextJSRouteManifest,
  ZephyrNextJSPluginOptions
} from '../types';
import { NextJSServerFunctionExtractor } from './server-function-extractor';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

interface NextJSUploadAgentOptions {
  zephyr_engine: ZephyrEngine;
  wait_for_index_html?: boolean;
  buildContext: {
    isServer: boolean;
    nextRuntime?: 'nodejs' | 'edge';
    buildId: string;
  };
  enableServerFunctions?: boolean;
  serverRuntime?: 'nodejs' | 'edge';
  enableMiddleware?: boolean;
  enableISR?: boolean;
  cacheStrategy?: 'kv' | 'r2' | 'hybrid';
  useNextjsWorker?: boolean;
  nextjsWorkerEndpoint?: string;
}

export interface NextJSZephyrAgentProps {
  stats: XStats;
  stats_json: XStatsCompilation;
  assets: Record<string, Source>;
  pluginOptions: NextJSUploadAgentOptions;
  outputPath: string;
}

export async function nextjsZephyrAgent({
  stats,
  stats_json,
  assets,
  pluginOptions,
  outputPath,
}: NextJSZephyrAgentProps): Promise<void> {
  ze_log.init('Initiating: Next.js Zephyr Upload Agent');

  const zeStart = Date.now();
  const { zephyr_engine, buildContext } = pluginOptions;

  try {
    // Build enhanced assets map with Next.js-specific metadata
    const enhancedAssetsMap = await buildNextJSAssetMap(
      assets,
      outputPath,
      buildContext,
      pluginOptions
    );

    // Get application configuration
    const { EDGE_URL, PLATFORM, DELIMITER } = await zephyr_engine.application_configuration;

    // Determine target endpoint
    const targetEndpoint = getNextJSWorkerEndpoint(EDGE_URL, pluginOptions);

    console.log(`🚀 Deploying to Next.js worker: ${targetEndpoint}`);

    // Create Next.js-specific snapshot
    const nextjsSnapshot = await createNextJSSnapshot(
      enhancedAssetsMap,
      outputPath,
      buildContext,
      pluginOptions
    );

    // Upload assets using Next.js worker protocol
    await uploadToNextJSWorker({
      assetsMap: enhancedAssetsMap.staticAssets,
      snapshot: nextjsSnapshot,
      endpoint: targetEndpoint,
      engine: zephyr_engine,
    });

  } catch (err) {
    logFn('error', ZephyrError.format(err));
    throw err;
  } finally {
    ze_log.upload('Next.js Zephyr Upload Agent: Done in', Date.now() - zeStart, 'ms');
  }
}

interface EnhancedAssetsMap {
  staticAssets: Record<string, any>;
  serverFunctions: ZephyrServerAsset[];
  routeManifest?: NextJSRouteManifest;
  buildManifest?: NextJSBuildManifest;
  middleware?: ZephyrServerAsset[];
}

async function buildNextJSAssetMap(
  assets: Record<string, Source>,
  outputPath: string,
  buildContext: any,
  options: NextJSUploadAgentOptions
): Promise<EnhancedAssetsMap> {
  const result: EnhancedAssetsMap = {
    staticAssets: {},
    serverFunctions: [],
  };

  // Process static assets (unchanged from standard flow)
  for (const [path, source] of Object.entries(assets)) {
    const content = source.source();
    const contentBuffer = Buffer.isBuffer(content) ? content : Buffer.from(content);
    
    result.staticAssets[path] = {
      content: contentBuffer,
      hash: require('crypto').createHash('md5').update(contentBuffer).digest('hex'),
      size: contentBuffer.length,
      headers: getContentTypeHeaders(path),
    };
  }

  // Extract server functions from server build only
  if (buildContext.isServer) {
    try {
      const extractor = new NextJSServerFunctionExtractor(
        outputPath,
        buildContext.buildId,
        options
      );
      
      const { serverFunctions, routeManifest, buildManifest } = 
        await extractor.extractServerFunctions();
      
      result.serverFunctions = serverFunctions;
      result.routeManifest = routeManifest;
      result.buildManifest = buildManifest;
      
      console.log(`📦 Extracted ${serverFunctions.length} server functions from server build`);
    } catch (error) {
      console.warn('⚠️ Failed to extract server functions:', error);
    }
  } else {
    console.log(`📦 Client build - static assets only, no server function extraction`);
  }

  return result;
}

async function createNextJSSnapshot(
  assetsMap: EnhancedAssetsMap,
  outputPath: string,
  buildContext: any,
  options: NextJSUploadAgentOptions
): Promise<any> {
  const config = await options.zephyr_engine.application_configuration;
  
  // Convert static assets to snapshot format
  const staticAssets = Object.entries(assetsMap.staticAssets).map(([path, asset]) => ({
    id: asset.hash,
    filepath: path,
    headers: asset.headers,
    compressed: path.endsWith('.gz'),
  }));

  const staticAssetsMap = Object.fromEntries(
    staticAssets.map(asset => [asset.filepath, asset])
  );

  // Build server functions map
  const serverFunctionsMap = Object.fromEntries(
    assetsMap.serverFunctions.map(func => [func.path, func])
  );

  // Extract routes from manifests and server functions
  const pages = assetsMap.routeManifest?.pages ? Object.keys(assetsMap.routeManifest.pages) : [];
  const apiRoutes = [
    ...(assetsMap.routeManifest?.apiRoutes ? Object.keys(assetsMap.routeManifest.apiRoutes) : []),
    ...assetsMap.serverFunctions
      .filter(func => func.type === 'api-route')
      .flatMap(func => func.routes)
  ];

  // Create snapshot in format expected by ze-worker-nextjs-deploy
  const snapshot: any = {
    application_uid: config.application_uid,
    buildId: buildContext.buildId,
    timestamp: Date.now(),
    assets: staticAssets,
    assetsMap: staticAssetsMap,
    functions: serverFunctionsMap,
    routes: {
      pages,
      api: apiRoutes
    },
    config: {
      images: assetsMap.buildManifest ? extractImageConfig(assetsMap.buildManifest) : undefined,
      experimental: {} // TODO: Extract from Next.js config if available
    },
    middleware: assetsMap.middleware?.[0]?.path // Single middleware file path
  };

  return snapshot;
}

function extractImageConfig(buildManifest: NextJSBuildManifest): any {
  // Extract image configuration from Next.js build manifest
  // This is a simplified version - real implementation would parse next.config.js
  return {
    domains: [],
    remotePatterns: [],
    formats: ['image/webp'],
    sizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
  };
}

function getNextJSWorkerEndpoint(baseUrl: string, options: NextJSUploadAgentOptions): string {
  // Local development override
  if (process.env.ZE_LOCAL_NEXTJS_WORKER) {
    console.log(`🔧 Using local Next.js worker: ${process.env.ZE_LOCAL_NEXTJS_WORKER}`);
    return process.env.ZE_LOCAL_NEXTJS_WORKER;
  }

  // If explicitly configured, use that
  if (options.nextjsWorkerEndpoint) {
    return options.nextjsWorkerEndpoint;
  }

  // If useNextjsWorker is false, use standard endpoint
  if (options.useNextjsWorker === false) {
    return baseUrl;
  }

  // Convert standard worker URL to Next.js worker URL
  // ze.zephyrcloud.app -> nextjs-ze.zephyrcloud.app
  // ze.zephyrcloudapp.dev -> nextjs-ze.zephyrcloudapp.dev
  const url = new URL(baseUrl);
  const hostname = url.hostname;
  
  if (hostname.startsWith('ze.')) {
    url.hostname = hostname.replace('ze.', 'nextjs-ze.');
  } else if (hostname.includes('-ze.')) {
    url.hostname = hostname.replace('-ze.', '-nextjs-ze.');
  } else {
    // Fallback: prepend nextjs-
    url.hostname = 'nextjs-' + hostname;
  }

  return url.toString();
}

interface UploadToNextJSWorkerOptions {
  assetsMap: Record<string, any>;
  snapshot: any;
  endpoint: string;
  engine: ZephyrEngine;
}

async function uploadToNextJSWorker({
  assetsMap,
  snapshot,
  endpoint,
  engine,
}: UploadToNextJSWorkerOptions): Promise<void> {
  const config = await engine.application_configuration;
  
  // Upload snapshot first using Next.js worker protocol
  await uploadNextJSSnapshot(snapshot, endpoint, config.jwt);
  
  // Upload individual assets
  const uploadPromises = Object.entries(assetsMap).map(async ([path, asset]) => {
    return uploadNextJSAsset(path, asset, endpoint, config.jwt);
  });

  await Promise.all(uploadPromises);
  
  console.log(`✅ Uploaded ${Object.keys(assetsMap).length} assets to Next.js worker`);
}

async function uploadNextJSSnapshot(
  snapshot: any,
  endpoint: string,
  jwt: string
): Promise<void> {
  const url = new URL('/__zephyr_deploy', endpoint);
  
  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${jwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(snapshot),
  });

  if (!response.ok) {
    throw new Error(`Failed to upload Next.js snapshot: ${response.status} ${response.statusText}`);
  }
}

async function uploadNextJSAsset(
  path: string,
  asset: any,
  endpoint: string,
  jwt: string
): Promise<void> {
  const url = new URL('/__zephyr_upload', endpoint);
  url.searchParams.set('type', 'file');
  url.searchParams.set('hash', asset.hash);
  
  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${jwt}`,
      'x-file-path': path,
      'Content-Type': asset.headers?.['Content-Type'] || 'application/octet-stream',
    },
    body: asset.content,
  });

  if (!response.ok) {
    throw new Error(`Failed to upload asset ${path}: ${response.status} ${response.statusText}`);
  }
}

function getContentTypeHeaders(filePath: string): Record<string, string> {
  const ext = filePath.split('.').pop()?.toLowerCase();
  
  switch (ext) {
    case 'html':
      return { 'Content-Type': 'text/html; charset=utf-8' };
    case 'js':
      return { 'Content-Type': 'application/javascript; charset=utf-8' };
    case 'css':
      return { 'Content-Type': 'text/css; charset=utf-8' };
    case 'json':
      return { 'Content-Type': 'application/json; charset=utf-8' };
    case 'png':
      return { 'Content-Type': 'image/png' };
    case 'jpg':
    case 'jpeg':
      return { 'Content-Type': 'image/jpeg' };
    case 'svg':
      return { 'Content-Type': 'image/svg+xml' };
    case 'ico':
      return { 'Content-Type': 'image/x-icon' };
    case 'woff':
      return { 'Content-Type': 'font/woff' };
    case 'woff2':
      return { 'Content-Type': 'font/woff2' };
    default:
      return { 'Content-Type': 'application/octet-stream' };
  }
}