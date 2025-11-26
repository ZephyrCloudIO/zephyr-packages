/**
 * Deploy Next.js command: Deploy a Next.js application to Zephyr with serverless
 * functions
 */

import * as fs from 'fs';
import * as path from 'path';
import { ZephyrEngine, buildAssetsMap, logFn } from 'zephyr-agent';
import type { ZeBuildAssetsMap } from 'zephyr-edge-contract';
import {
  bundleAllServerlessRoutes,
  cleanupBundles,
  getTotalBundleSize,
} from '../lib/nextjs/bundle-functions';
import {
  classifyRoutes,
  getEdgeRoutes,
  getServerlessRoutes,
  getStaticRoutes,
  parseAllManifests,
} from '../lib/nextjs/parse-manifests';
import { DeployNextjsOptions, DeploymentPlan } from '../lib/nextjs/types';
import {
  findNextDir,
  formatBytes,
  getRelativePath,
  normalizePath,
  validateNextBuild,
} from '../lib/nextjs/utils';
import { uploadAssets } from '../lib/upload';

/**
 * Deploy Next.js command
 *
 * @param options - Deployment options
 */
export async function deployNextjsCommand(options: DeployNextjsOptions): Promise<void> {
  const { directory, cwd, verbose, target } = options;

  console.error('[ze-cli] Deploying Next.js application...');

  let deploymentPlan: DeploymentPlan | null = null;

  try {
    // Step 1: Find and validate .next directory
    const projectDir = path.resolve(cwd, directory);
    const nextDir = findNextDir(projectDir);
    validateNextBuild(nextDir);

    if (verbose) {
      logFn('info', `Next.js build directory: ${nextDir}`);
    }

    // Step 2: Parse all manifests
    console.error('[ze-cli] Parsing Next.js manifests...');
    const manifests = parseAllManifests(nextDir);

    if (verbose) {
      logFn('info', `Build ID: ${manifests.buildId}`);
      logFn('info', `Base path: ${manifests.routes.basePath || '/'}`);
    }

    // Step 3: Classify routes
    console.error('[ze-cli] Classifying routes...');
    const routes = classifyRoutes(nextDir, manifests);

    const staticRoutes = getStaticRoutes(routes);
    const serverlessRoutes = getServerlessRoutes(routes);
    const edgeRoutes = getEdgeRoutes(routes);

    console.error('[ze-cli] Route summary:');
    console.error(`  - Static pages: ${staticRoutes.length}`);
    console.error(`  - Serverless functions: ${serverlessRoutes.length}`);
    console.error(`  - Edge functions: ${edgeRoutes.length}`);

    if (verbose) {
      console.error('\n[ze-cli] Static routes:');
      staticRoutes.forEach((r) => console.error(`  - ${r.path}`));
      console.error('\n[ze-cli] Serverless routes:');
      serverlessRoutes.forEach((r) => console.error(`  - ${r.path} (${r.type})`));
      if (edgeRoutes.length > 0) {
        console.error('\n[ze-cli] Edge routes:');
        edgeRoutes.forEach((r) => console.error(`  - ${r.path}`));
      }
    }

    // Step 4: Create deployment plan
    deploymentPlan = createDeploymentPlan(nextDir, manifests, routes, verbose || false);

    // Step 5: Bundle serverless functions
    if (serverlessRoutes.length > 0) {
      console.error('[ze-cli] Bundling serverless functions...');
      const serverlessFunctions = bundleAllServerlessRoutes(
        nextDir,
        serverlessRoutes,
        manifests,
        verbose
      );
      deploymentPlan.serverlessFunctions = serverlessFunctions;

      const totalSize = getTotalBundleSize(serverlessFunctions);
      console.error(`[ze-cli] Total bundle size: ${formatBytes(totalSize)}`);
    }

    // Step 6: Bundle edge functions (if any)
    if (edgeRoutes.length > 0) {
      console.error('[ze-cli] Bundling edge functions...');
      const edgeFunctions = bundleAllServerlessRoutes(
        nextDir,
        edgeRoutes,
        manifests,
        verbose
      );
      deploymentPlan.edgeFunctions = edgeFunctions;
    }

    // Step 7: Initialize ZephyrEngine
    console.error('[ze-cli] Initializing deployment...');
    const zephyr_engine = await ZephyrEngine.create({
      builder: 'unknown', // TODO: Add 'nextjs' as a supported builder type
      context: projectDir,
    });

    // Set target if specified
    if (target) {
      zephyr_engine.env.target = target;
    }

    // Next.js always uses SSR (even for static pages, the server is involved)
    zephyr_engine.env.ssr = true;

    // Step 8: Upload everything
    await uploadNextjsDeployment(
      zephyr_engine,
      nextDir,
      deploymentPlan,
      verbose || false
    );

    console.error('[ze-cli] ✓ Deployment completed successfully!');
  } catch (error) {
    console.error('[ze-cli] ✗ Deployment failed');
    throw error;
  } finally {
    // Step 9: Cleanup (always run, even on error)
    if (deploymentPlan) {
      console.error('[ze-cli] Cleaning up temporary files...');
      cleanupBundles(deploymentPlan.serverlessFunctions);
      cleanupBundles(deploymentPlan.edgeFunctions);
    }
  }
}

/**
 * Create a deployment plan by collecting all static files
 *
 * @param nextDir - Path to .next directory
 * @param manifests - Parsed manifests
 * @param routes - Classified routes
 * @param verbose - Verbose logging
 * @returns Deployment plan
 */
function createDeploymentPlan(
  nextDir: string,
  manifests: any,
  routes: any[],
  verbose: boolean
): DeploymentPlan {
  const staticFiles = new Map<string, string>();

  // Collect static assets from .next/static/
  const staticDir = path.join(nextDir, 'static');
  if (fs.existsSync(staticDir)) {
    collectStaticAssets(staticDir, staticFiles, nextDir, verbose);
  }

  // Collect pre-rendered HTML files
  const serverDir = path.join(nextDir, 'server');
  collectPrerenderedHtml(serverDir, staticFiles, nextDir, routes, verbose);

  return {
    staticFiles,
    serverlessFunctions: [],
    edgeFunctions: [],
    config: manifests.requiredServerFiles.config,
    buildId: manifests.buildId,
    routes,
  };
}

/**
 * Collect static assets (JS, CSS, images, etc.) from .next/static/ These will be uploaded
 * to /_next/static/*
 *
 * @param staticDir - Path to .next/static directory
 * @param staticFiles - Map to populate
 * @param nextDir - Path to .next directory
 * @param verbose - Verbose logging
 */
function collectStaticAssets(
  staticDir: string,
  staticFiles: Map<string, string>,
  nextDir: string,
  verbose: boolean
): void {
  const files = getAllFilesRecursively(staticDir);

  for (const file of files) {
    // Get path relative to .next directory
    const relPath = getRelativePath(nextDir, file);

    // Upload path should be /_next/...
    const uploadPath = `/_next/${relPath}`;

    staticFiles.set(uploadPath, file);
  }

  if (verbose) {
    logFn('info', `Collected ${files.length} static assets`);
  }
}

/**
 * Collect pre-rendered HTML files from .next/server/app/
 *
 * @param serverDir - Path to .next/server directory
 * @param staticFiles - Map to populate
 * @param nextDir - Path to .next directory
 * @param routes - Classified routes
 * @param verbose - Verbose logging
 */
function collectPrerenderedHtml(
  serverDir: string,
  staticFiles: Map<string, string>,
  nextDir: string,
  routes: any[],
  verbose: boolean
): void {
  // Find all index.html files (pre-rendered pages)
  const htmlFiles = findHtmlFiles(serverDir);

  for (const htmlFile of htmlFiles) {
    // Determine the route path from the file location
    const relPath = getRelativePath(serverDir, htmlFile);

    // For App Router: app/page-name/index.html -> /page-name
    // For root: app/index.html -> /
    let uploadPath: string;

    if (relPath.startsWith('app/')) {
      const pathParts = relPath.slice(4).split('/'); // Remove 'app/'
      pathParts.pop(); // Remove 'index.html'

      if (pathParts.length === 0) {
        uploadPath = '/index.html';
      } else {
        uploadPath = '/' + pathParts.join('/') + '.html';
      }
    } else if (relPath.startsWith('pages/')) {
      // Pages Router
      const pathParts = relPath.slice(6).split('/'); // Remove 'pages/'
      const fileName = pathParts.pop() || '';

      if (fileName === 'index.html') {
        uploadPath =
          pathParts.length === 0 ? '/index.html' : '/' + pathParts.join('/') + '.html';
      } else {
        uploadPath = '/' + pathParts.concat(fileName).join('/');
      }
    } else {
      // Other HTML files, preserve path
      uploadPath = '/' + relPath;
    }

    staticFiles.set(uploadPath, htmlFile);
  }

  if (verbose && htmlFiles.length > 0) {
    logFn('info', `Collected ${htmlFiles.length} pre-rendered HTML files`);
  }
}

/**
 * Find all HTML files in a directory recursively
 *
 * @param dir - Directory to search
 * @returns Array of HTML file paths
 */
function findHtmlFiles(dir: string): string[] {
  const htmlFiles: string[] = [];

  function walk(currentDir: string): void {
    if (!fs.existsSync(currentDir)) return;

    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.html')) {
        htmlFiles.push(fullPath);
      }
    }
  }

  walk(dir);
  return htmlFiles;
}

/**
 * Get all files in a directory recursively
 *
 * @param dir - Directory to search
 * @returns Array of file paths
 */
function getAllFilesRecursively(dir: string): string[] {
  const files: string[] = [];

  function walk(currentDir: string): void {
    if (!fs.existsSync(currentDir)) return;

    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  }

  walk(dir);
  return files;
}

/**
 * Upload the complete Next.js deployment (static files + functions)
 *
 * @param zephyr_engine - Zephyr engine instance
 * @param nextDir - Path to .next directory
 * @param plan - Deployment plan
 * @param verbose - Verbose logging
 */
async function uploadNextjsDeployment(
  zephyr_engine: ZephyrEngine,
  nextDir: string,
  plan: DeploymentPlan,
  verbose: boolean
): Promise<void> {
  console.error('[ze-cli] Uploading deployment...');

  // Convert static files to assets map
  const staticAssetsMap = await createAssetsMapFromFiles(plan.staticFiles, verbose);

  if (verbose) {
    logFn('info', `Uploading ${Object.keys(staticAssetsMap).length} static assets`);
  }

  // Upload static assets
  await uploadAssets({
    zephyr_engine,
    assetsMap: staticAssetsMap,
  });

  // TODO: Upload serverless functions
  // This requires extending ZephyrEngine to support function uploads
  // For now, we'll log what would be uploaded
  if (plan.serverlessFunctions.length > 0) {
    console.error(
      `[ze-cli] Note: ${plan.serverlessFunctions.length} serverless functions are bundled and ready`
    );
    console.error(
      '[ze-cli] Function deployment will be implemented when ZephyrEngine function API is ready'
    );

    if (verbose) {
      console.error('\n[ze-cli] Function details:');
      for (const func of plan.serverlessFunctions) {
        console.error(`  - ${func.route} -> ${func.entryPoint}`);
        console.error(`    Runtime: ${func.runtime}`);
        console.error(`    Bundle: ${func.bundleDir}`);
        console.error(`    Dependencies: ${func.dependencies.length} files`);
      }
    }
  }

  // TODO: Upload edge functions
  if (plan.edgeFunctions.length > 0) {
    console.error(
      `[ze-cli] Note: ${plan.edgeFunctions.length} edge functions are bundled and ready`
    );
    console.error(
      '[ze-cli] Edge function deployment will be implemented when ZephyrEngine edge API is ready'
    );
  }
}

/**
 * Create ZeBuildAssetsMap from file paths
 *
 * @param fileMap - Map of upload path -> local file path
 * @param verbose - Verbose logging
 * @returns Assets map
 */
async function createAssetsMapFromFiles(
  fileMap: Map<string, string>,
  verbose: boolean
): Promise<ZeBuildAssetsMap> {
  const assets: Record<string, { content: Buffer; type: string }> = {};

  for (const [uploadPath, localPath] of fileMap.entries()) {
    try {
      const content = fs.readFileSync(localPath);
      const type = getFileType(localPath);

      // Normalize path for consistent handling and remove leading slash
      let normalizedPath = normalizePath(uploadPath);
      if (normalizedPath.startsWith('/')) {
        normalizedPath = normalizedPath.slice(1);
      }

      if (normalizedPath.startsWith('static/')) {
        normalizedPath = `client/${normalizedPath}`;
      }

      assets[normalizedPath] = {
        content,
        type,
      };
    } catch (error) {
      console.error(
        `[ze-cli] Warning: Failed to read file ${localPath}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  return buildAssetsMap(
    assets,
    (asset) => asset.content,
    (asset) => asset.type
  );
}

/**
 * Get MIME type for a file based on extension
 *
 * @param filePath - File path
 * @returns MIME type string
 */
function getFileType(filePath: string): string {
  const extension = path.extname(filePath).slice(1).toLowerCase();

  const typeMap: Record<string, string> = {
    html: 'text/html',
    css: 'text/css',
    js: 'application/javascript',
    mjs: 'application/javascript',
    json: 'application/json',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    ico: 'image/x-icon',
    woff: 'font/woff',
    woff2: 'font/woff2',
    ttf: 'font/ttf',
    eot: 'application/vnd.ms-fontobject',
    xml: 'text/xml',
    txt: 'text/plain',
    webp: 'image/webp',
    avif: 'image/avif',
    wasm: 'application/wasm',
  };

  return typeMap[extension] || 'application/octet-stream';
}
