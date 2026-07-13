import {
  type Snapshot,
  type SnapshotAsset,
  type ZeBuildAssetsMap,
  type ZephyrPluginOptions,
  createApplicationUid,
  flatCreateSnapshotId,
} from 'zephyr-edge-contract';
import {
  applyBaseHrefToAssets,
  applyBaseHrefToPath,
  normalizeBasePath,
} from './ze-basehref-handler';
import type { ZephyrEngine } from '../../zephyr-engine';
import { ZeErrors, ZephyrError } from '../errors';
import { getZephyrAgentVersion } from '../version/zephyr-agent-version';
import { posix, win32 } from 'node:path';

interface CreateSnapshotProps {
  mfConfig: Pick<ZephyrPluginOptions, 'mfConfig'>['mfConfig'];
  mfConfigs?: Pick<ZephyrPluginOptions, 'mfConfigs'>['mfConfigs'];
  assets: ZeBuildAssetsMap;
  // SSR-specific parameter
  snapshotType?: 'csr' | 'ssr';
  entrypoint?: string;
}

export async function createSnapshot(
  zephyr_engine: ZephyrEngine,
  { mfConfig, mfConfigs, assets, snapshotType, entrypoint }: CreateSnapshotProps
): Promise<Snapshot> {
  const buildId = await zephyr_engine.build_id;

  if (!buildId) {
    await zephyr_engine.build_id;
    throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
      message: 'Cannot create snapshot before getting buildId',
    });
  }

  const options = {
    git_branch: zephyr_engine.gitProperties.git.branch,
    buildId,
    username: (await zephyr_engine.application_configuration).username,
    email: (await zephyr_engine.application_configuration).email,
    applicationProperties: zephyr_engine.applicationProperties,
    edge_url: (await zephyr_engine.application_configuration).EDGE_URL,
    address_mode: (await zephyr_engine.application_configuration).ADDRESS_MODE,
    gitProperties: zephyr_engine.gitProperties,
    mfConfig: mfConfig,
    mfConfigs: mfConfigs,
  };
  const version_postfix = zephyr_engine.env.isCI
    ? `${options.git_branch}.${options.buildId}`
    : `${options.username}.${options.buildId}`;

  // TAP package descriptors and locks address emitted artifacts by their exact paths and
  // hashes. A deployment base is a web-routing concern, so applying it here would turn a
  // valid locked package into a different snapshot without rebuilding the lock.
  const preservesLockedArtifactPaths = zephyr_engine.env.target === 'tap-app';
  const basedAssets = preservesLockedArtifactPaths
    ? assets
    : applyBaseHrefToAssets(assets, zephyr_engine.buildProperties.baseHref);
  const normalizedBaseHref = preservesLockedArtifactPaths
    ? ''
    : normalizeBasePath(zephyr_engine.buildProperties.baseHref);
  const basedEntrypoint =
    entrypoint && (snapshotType === 'ssr' || zephyr_engine.env.ssr)
      ? applyBaseHrefToPath(entrypoint, normalizedBaseHref)
      : entrypoint;

  const snapshot: Snapshot = {
    // ZeApplicationProperties
    application_uid: createApplicationUid(options.applicationProperties),
    version: `${options.applicationProperties.version}-${version_postfix}`,
    // ZeApplicationProperties + buildId + ZeApplicationProperties.username
    snapshot_id: flatCreateSnapshotId(
      Object.assign({}, options.applicationProperties, {
        buildId: options.buildId,
        username: options.username,
      })
    ),
    domain: options.edge_url,
    ...(options.address_mode === 'path' && { addressMode: 'path' as const }),
    target: zephyr_engine.env.target ?? 'web',
    uid: {
      build: options.buildId,
      app_name: options.applicationProperties.name,
      repo: options.applicationProperties.project,
      org: options.applicationProperties.org,
    },
    git: options.gitProperties.git,
    creator: {
      name: options.username,
      email: options.email,
    },
    createdAt: Date.now(),
    mfConfig: options.mfConfig,
    mfConfigs: options.mfConfigs,
    builder: zephyr_engine.builder,
    plugin_version: getZephyrAgentVersion(),
    assets: Object.keys(basedAssets).reduce(
      (memo, hash: string) => {
        const asset = basedAssets[hash];
        const { path, extname, size } = asset;
        const normalizedPath = normalizePathSeparators(path);
        memo[normalizedPath] = { path: normalizedPath, extname, hash: asset.hash, size };
        return memo;
      },
      {} as Record<string, SnapshotAsset>
    ),
    // Add type field for SSR snapshots
    ...(snapshotType && { type: snapshotType }),
    // Add entrypoint field if provided
    ...(basedEntrypoint && { entrypoint: basedEntrypoint }),
  };

  // Set snapshot type if SSR flag is enabled
  if (zephyr_engine.env.ssr) {
    snapshot.type = 'ssr';
  }

  return snapshot;
}

/**
 * Normalizes path separators to forward slashes for web compatibility Converts Windows
 * backslashes to forward slashes
 *
 * @param path - The path to normalize
 * @returns The path with forward slashes
 */
function normalizePathSeparators(path: string): string {
  return path.split(win32.sep).join(posix.sep);
}
