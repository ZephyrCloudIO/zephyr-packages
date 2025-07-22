import { posix, win32 } from 'node:path';
import {
  type Snapshot,
  type SnapshotAsset,
  type ZeBuildAssetsMap,
  type ZephyrPluginOptions,
  createApplicationUid,
  flatCreateSnapshotId,
} from 'zephyr-edge-contract';
import type { ZephyrEngine } from '../../zephyr-engine';
import { ZeErrors, ZephyrError } from '../errors';
import { ze_log } from '../logging';
import { applyBaseHrefToAssets } from './ze-basehref-handler';

interface CreateSnapshotProps {
  mfConfig: Pick<ZephyrPluginOptions, 'mfConfig'>['mfConfig'];
  assets: ZeBuildAssetsMap;
}

export async function createSnapshot(
  zephyr_engine: ZephyrEngine,
  { mfConfig, assets }: CreateSnapshotProps
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
    gitProperties: zephyr_engine.gitProperties,
    mfConfig: mfConfig,
  };
  const version_postfix = zephyr_engine.env.isCI
    ? `${options.git_branch}.${options.buildId}`
    : `${options.username}.${options.buildId}`;

  const basedAssets = applyBaseHrefToAssets(
    assets,
    zephyr_engine.buildProperties.baseHref
  );

  // Check if zephyr-manifest.json exists in the assets
  let manifestReference: ZephyrManifestRef | undefined;

  const manifestAsset = Object.values(basedAssets).find(
    (asset) => asset.path === 'zephyr-manifest.json'
  );

  if (
    manifestAsset &&
    zephyr_engine.federated_dependencies &&
    zephyr_engine.federated_dependencies.length > 0
  ) {
    ze_log.snapshot('Found zephyr-manifest.json in assets');
    manifestReference = {
      filename: 'zephyr-manifest.json',
      remotes: zephyr_engine.federated_dependencies.map((dep) => dep.name),
    };
    ze_log.snapshot('Created manifest reference:', manifestReference);
  } else {
    ze_log.snapshot('No manifest file found in assets or no federated dependencies');
  }

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
  };

  // Add the manifest reference as a custom field
  // We'll use a type assertion to bypass the type check for now
  (snapshot as any)['zephyr:dependencies'] = manifestReference;

  ze_log.snapshot('Created snapshot with ID:', snapshot.snapshot_id);
  if (manifestReference) {
    ze_log.snapshot('Snapshot includes manifest reference:', manifestReference);
  } else {
    ze_log.snapshot('Snapshot has no manifest reference');
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
