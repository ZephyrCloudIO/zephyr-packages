import { relative, resolve as resolvePath } from 'node:path';
import {
  assertZephyrBuildTarget,
  type ZephyrBuildTarget,
  type ZephyrLegacyModuleFederationConfig,
  type ZephyrModuleFederationBuildMetadata,
  type ZephyrModuleFederationConfig,
} from 'zephyr-edge-contract';
import type { ZephyrBuildHooks, ZephyrEngineOptions } from '../zephyr-engine';
import { ZephyrEngine } from '../zephyr-engine';
import { ZeErrors, ZephyrError } from './errors';
import { buildAssetsMapMock as buildAssetsMap } from './transformers/ze-build-assets-map';
import { zeBuildDashData } from './transformers/ze-build-dash-data';
import { readDirRecursiveWithContents } from './utils/read-dir-recursive';

const DEFAULT_DEPLOY_TARGET: ZephyrBuildTarget = 'web';
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
  target?: ZephyrBuildTarget;
  /** Every independently published Module Federation container. */
  mfConfigs?: ZephyrModuleFederationConfig[];
  /** Build-stat metadata paired with `mfConfigs`. */
  federation?: ZephyrModuleFederationBuildMetadata[];
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
  baseURL = '/',
  preserveArtifactPaths = false
): string {
  const relativePath = normalizePath(file.relativePath);
  // TAP descriptors and locks own the package namespace. A framework's public-dir
  // alias or routing base is transport metadata, not an artifact-path prefix.
  if (preserveArtifactPaths || !publicDir) {
    return relativePath;
  }

  const fullPath = normalizePath(file.fullPath);
  const publicRoot = normalizePath(publicDir).replace(/\/+$/, '');
  const outputRoot = normalizePath(outputDir).replace(/\/+$/, '');
  const publicRelativeRoot = normalizePath(relative(outputRoot, publicRoot)).replace(
    /\/+$/,
    ''
  );
  const isWithinPublicAlias =
    !!publicRelativeRoot && relativePath.startsWith(`${publicRelativeRoot}/`);

  if (fullPath.startsWith(`${publicRoot}/`) || isWithinPublicAlias) {
    const staticRelative = fullPath.startsWith(`${publicRoot}/`)
      ? fullPath.slice(publicRoot.length + 1)
      : relativePath.slice(publicRelativeRoot.length + 1);

    if (!staticRelative) {
      return relativePath;
    }

    const basePath = normalizeBaseURL(baseURL);
    return basePath ? `client/${basePath}/${staticRelative}` : `client/${staticRelative}`;
  }

  return relativePath;
}

function shouldSkipDeployAsset(
  filePath: string,
  preserveArtifactPaths: boolean
): boolean {
  // A TAP lock may deliberately include a source map, a file beneath a conventional
  // ignored directory, or another opaque binary. Generic deployment filters are a
  // convenience for web apps, never a reason to drop a locked package artifact.
  return (
    !preserveArtifactPaths &&
    SKIP_DEPLOY_PATTERNS.some((pattern) => pattern.test(filePath))
  );
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

function getLegacyModuleFederationConfig(
  mfConfigs: readonly ZephyrModuleFederationConfig[] | undefined
): ZephyrLegacyModuleFederationConfig | undefined {
  const config = mfConfigs?.length === 1 ? mfConfigs[0] : undefined;
  return config && typeof config.name === 'string' && typeof config.filename === 'string'
    ? (config as ZephyrLegacyModuleFederationConfig)
    : undefined;
}

function assertTapFederationMetadata(
  mfConfigs: readonly ZephyrModuleFederationConfig[] | undefined,
  federation: readonly ZephyrModuleFederationBuildMetadata[] | undefined
): void {
  if (!mfConfigs?.length || !federation?.length) {
    throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
      message:
        'tap-app output publication requires non-empty mfConfigs and federation metadata arrays.',
    });
  }
  if (mfConfigs.length !== federation.length) {
    throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
      message:
        'tap-app mfConfigs and federation metadata must contain the same containers.',
    });
  }

  const federationByName = new Map<string, ZephyrModuleFederationBuildMetadata>();
  const federationRemotes = new Set<string>();
  for (const entry of federation) {
    if (typeof entry.name !== 'string' || !entry.name.trim()) {
      throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
        message: 'tap-app federation entries require non-empty name and remote values.',
      });
    }
    if (typeof entry.remote !== 'string' || !entry.remote.trim()) {
      throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
        message: 'tap-app federation entries require non-empty name and remote values.',
      });
    }
    if (federationByName.has(entry.name) || federationRemotes.has(entry.remote)) {
      throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
        message: 'tap-app federation entries must not duplicate names or remotes.',
      });
    }
    federationByName.set(entry.name, entry);
    federationRemotes.add(entry.remote);
  }
  const configNames = new Set<string>();
  const configFilenames = new Set<string>();
  for (const config of mfConfigs) {
    if (
      typeof config.name !== 'string' ||
      !config.name.trim() ||
      typeof config.filename !== 'string' ||
      !config.filename.trim()
    ) {
      throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
        message: 'tap-app mfConfigs entries require non-empty name and filename values.',
      });
    }
    if (configNames.has(config.name) || configFilenames.has(config.filename)) {
      throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
        message: 'tap-app mfConfigs entries must not duplicate names or filenames.',
      });
    }
    const entry = federationByName.get(config.name);
    if (!entry || entry.remote !== config.filename) {
      throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
        message:
          `tap-app Federation metadata for ${JSON.stringify(config.name)} must use ` +
          `remote ${JSON.stringify(config.filename)}.`,
      });
    }
    configNames.add(config.name);
    configFilenames.add(config.filename);
  }
}

export async function uploadOutputToZephyr(
  opts: UploadOutputToZephyrOptions
): Promise<UploadOutputToZephyrResult> {
  const target = opts.target ?? DEFAULT_DEPLOY_TARGET;
  assertZephyrBuildTarget(target, 'uploadOutputToZephyr({ target })');
  if (target === 'tap-app') {
    assertTapFederationMetadata(opts.mfConfigs, opts.federation);
  }
  const preserveArtifactPaths = target === 'tap-app';
  const outputDir = resolvePath(opts.outputDir);
  const publicDir = opts.publicDir ? resolvePath(opts.publicDir) : undefined;
  const files = await readDirRecursiveWithContents(outputDir, {
    includeIgnoredPaths: preserveArtifactPaths,
    failOnError: preserveArtifactPaths,
  });

  const assets: Record<string, DirectoryAsset> = {};
  const assetSources = new Map<string, string>();
  for (const file of files) {
    const relativePath = resolveAssetPath(
      file,
      outputDir,
      publicDir,
      opts.baseURL,
      preserveArtifactPaths
    );
    if (shouldSkipDeployAsset(relativePath, preserveArtifactPaths)) {
      continue;
    }

    const existingSource = assetSources.get(relativePath);
    if (existingSource) {
      throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
        message:
          `uploadOutputToZephyr found conflicting output files for snapshot path ` +
          `"${relativePath}": "${existingSource}" and "${file.fullPath}".`,
      });
    }
    assets[relativePath] = {
      content: file.content,
    };
    assetSources.set(relativePath, file.fullPath);
  }

  if (Object.keys(assets).length === 0) {
    throw new ZephyrError(ZeErrors.ERR_ASSETS_NOT_FOUND);
  }

  // TAP package output is a collection of SDK-built target entries, not a
  // conventional framework server bundle. Keep the established SSR default for
  // generic web output, but make TAP publication CSR unless its caller
  // explicitly supplies an SSR entrypoint contract.
  const ssr = opts.ssr ?? (target === 'tap-app' ? false : DEFAULT_DEPLOY_SSR);
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
    target,
  });
  let buildInProgress = true;

  try {
    zephyrEngine.env.target = target;
    zephyrEngine.env.ssr = ssr;

    const buildStats = await zeBuildDashData(zephyrEngine);
    const mfConfig = getLegacyModuleFederationConfig(opts.mfConfigs);
    const buildStatsWithFederation = opts.federation
      ? { ...buildStats, federation: opts.federation }
      : buildStats;
    let deploymentUrl: string | null = null;

    await zephyrEngine.upload_assets({
      assetsMap,
      buildStats: buildStatsWithFederation,
      ...(mfConfig ? { mfConfig } : {}),
      ...(opts.mfConfigs ? { mfConfigs: opts.mfConfigs } : {}),
      snapshotType: ssr ? 'ssr' : 'csr',
      entrypoint: ssr ? entrypoint : undefined,
      hooks: {
        onDeployComplete: async (deploymentInfo) => {
          deploymentUrl = deploymentInfo.url;
          await opts.hooks?.onDeployComplete?.(deploymentInfo);
        },
      },
    });
    buildInProgress = false;
    await zephyrEngine.build_finished();

    return { deploymentUrl, entrypoint };
  } finally {
    if (buildInProgress && zephyrEngine.hasActiveBuild !== false) {
      zephyrEngine.build_failed();
    }
  }
}
