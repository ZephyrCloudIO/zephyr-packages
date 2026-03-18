import { relative, resolve as resolvePath } from 'node:path';
import type { Platform, ZephyrBuildHooks, ZephyrEngineOptions } from '../zephyr-engine';
import { ZephyrEngine } from '../zephyr-engine';
import { ZeErrors, ZephyrError } from './errors';
import { buildAssetsMapMock as buildAssetsMap } from './transformers/ze-build-assets-map';
import { zeBuildDashData } from './transformers/ze-build-dash-data';
import { readDirRecursiveWithContents } from './utils/read-dir-recursive';

const DEFAULT_DEPLOY_TARGET: Platform = 'web';
const DEFAULT_DEPLOY_SSR = true;
const SKIP_DEPLOY_PATTERNS = [
  /\.map$/i,
  /node_modules\//i,
  /\.git\//i,
  /\.DS_Store$/i,
  /^\.zephyr\//i,
  /thumbs\.db$/i,
];
const DEPLOY_ENTRYPOINT_CANDIDATES = [
  'server/index.js',
  'server/index.mjs',
  'server/server.js',
  'server/server.mjs',
  'server/_worker.js',
  'server/_worker.mjs',
  'index.mjs',
  'index.js',
] as const;

interface DirectoryAsset {
  content: Buffer;
}

export interface UploadOutputToZephyrOptions {
  rootDir: string;
  outputDir: string;
  publicDir?: string;
  baseURL?: string;
  builder?: ZephyrEngineOptions['builder'];
  target?: Platform;
  ssr?: boolean;
  hooks?: ZephyrBuildHooks;
}

export interface UploadOutputToZephyrResult {
  deploymentUrl: string | null;
  entrypoint?: string;
}

/**
 * Generic deploy helper for uploading a framework output directory to Zephyr.
 *
 * Example use case:
 *
 * - Nitro preset generates `.output/{server,client}`
 * - Caller maps `publicDir` + `baseURL`
 * - Helper uploads assets and returns `deploymentUrl`
 */

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, '/').replace(/^\.?\//, '');
}

function normalizeBaseURL(baseURL: string): string {
  let normalized = baseURL.trim().replace(/\\/g, '/');

  while (normalized.startsWith('./')) {
    normalized = normalized.slice(2);
  }
  while (normalized.startsWith('/')) {
    normalized = normalized.slice(1);
  }
  while (normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }

  return normalized;
}

function resolveAssetPath(
  file: { fullPath: string; relativePath: string },
  outputDir: string,
  publicDir?: string,
  baseURL = '/'
): string {
  const relativePath = normalizePath(file.relativePath);
  if (!publicDir) {
    return relativePath;
  }

  const fullPath = normalizePath(file.fullPath);
  const publicRoot = normalizePath(publicDir).replace(/\/+$/, '');
  const outputRoot = normalizePath(outputDir).replace(/\/+$/, '');
  const publicRelativeRoot = normalizePath(relative(outputRoot, publicRoot)).replace(
    /\/+$/,
    ''
  );

  if (
    fullPath.startsWith(`${publicRoot}/`) ||
    relativePath === publicRelativeRoot ||
    relativePath.startsWith(`${publicRelativeRoot}/`)
  ) {
    const staticRelative = fullPath.startsWith(`${publicRoot}/`)
      ? fullPath.slice(publicRoot.length + 1)
      : relativePath.slice(publicRelativeRoot.length + 1);
    const basePath = normalizeBaseURL(baseURL);
    return basePath ? `client/${basePath}/${staticRelative}` : `client/${staticRelative}`;
  }

  return relativePath;
}

function shouldSkipDeployAsset(filePath: string): boolean {
  return SKIP_DEPLOY_PATTERNS.some((pattern) => pattern.test(filePath));
}

function resolveDeployEntrypoint(
  assets: Record<string, DirectoryAsset>
): string | undefined {
  for (const candidate of DEPLOY_ENTRYPOINT_CANDIDATES) {
    if (Object.prototype.hasOwnProperty.call(assets, candidate)) {
      return candidate;
    }
  }

  return undefined;
}

export async function uploadOutputToZephyr(
  opts: UploadOutputToZephyrOptions
): Promise<UploadOutputToZephyrResult> {
  const outputDir = resolvePath(opts.outputDir);
  const publicDir = opts.publicDir ? resolvePath(opts.publicDir) : undefined;
  const files = await readDirRecursiveWithContents(outputDir);

  const assets = files.reduce<Record<string, DirectoryAsset>>((memo, file) => {
    const relativePath = resolveAssetPath(file, outputDir, publicDir, opts.baseURL);
    if (shouldSkipDeployAsset(relativePath)) {
      return memo;
    }

    memo[relativePath] = {
      content: file.content,
    };
    return memo;
  }, {});

  if (Object.keys(assets).length === 0) {
    throw new ZephyrError(ZeErrors.ERR_ASSETS_NOT_FOUND);
  }

  const ssr = opts.ssr ?? DEFAULT_DEPLOY_SSR;
  const entrypoint = resolveDeployEntrypoint(assets);
  if (ssr && !entrypoint) {
    throw new ZephyrError(ZeErrors.ERR_SSR_ENTRYPOINT_NOT_FOUND, {
      outputDir,
      candidates: DEPLOY_ENTRYPOINT_CANDIDATES.join(', '),
    });
  }

  const assetsMap = buildAssetsMap(
    assets,
    (asset: DirectoryAsset) => asset.content,
    () => 'buffer'
  );

  const zephyrEngine = await ZephyrEngine.create({
    builder: opts.builder ?? 'unknown',
    context: opts.rootDir,
  });

  zephyrEngine.env.target = opts.target ?? DEFAULT_DEPLOY_TARGET;
  zephyrEngine.env.ssr = ssr;

  const buildStats = await zeBuildDashData(zephyrEngine);
  let deploymentUrl: string | null = null;

  await zephyrEngine.upload_assets({
    assetsMap,
    buildStats,
    snapshotType: ssr ? 'ssr' : 'csr',
    entrypoint: ssr ? entrypoint : undefined,
    hooks: {
      onDeployComplete: async (deploymentInfo) => {
        deploymentUrl = deploymentInfo.url;
        await opts.hooks?.onDeployComplete?.(deploymentInfo);
      },
    },
  });

  return { deploymentUrl, entrypoint };
}
