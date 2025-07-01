import {
  type Snapshot,
  type SnapshotAsset,
  type ZeBuildAssetsMap,
  type ZephyrPluginOptions,
  createApplicationUid,
  flatCreateSnapshotId,
} from 'zephyr-edge-contract';
import { applyBaseHrefToAssets } from './ze-basehref-handler';
import type { ZephyrEngine } from '../../zephyr-engine';
import { ZeErrors, ZephyrError } from '../errors';

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

  // Build resolvedRemotes object from federated_dependencies
  const resolvedRemotes: Record<string, {
    application_uid: string;
    remote_entry_url: string;
    default_url: string;
    name: string;
    library_type: string;
  }> = {};

  if (zephyr_engine.federated_dependencies) {
    console.log('[Plugin] ze-build-snapshot: Building resolved remotes from federated dependencies');
    console.log(`[Plugin] ze-build-snapshot: Found ${zephyr_engine.federated_dependencies.length} dependencies`);
    
    zephyr_engine.federated_dependencies.forEach(dep => {
      resolvedRemotes[dep.name] = {
        application_uid: dep.application_uid,
        remote_entry_url: dep.remote_entry_url,
        default_url: dep.default_url,
        name: dep.name,
        library_type: dep.library_type,
      };
      console.log(`[Plugin] ze-build-snapshot: Added dependency ${dep.name} -> ${dep.remote_entry_url}`);
    });
  } else {
    console.log('[Plugin] ze-build-snapshot: No federated dependencies found');
  }
  

  const snapshot = {
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
    'zephyr:dependencies': Object.keys(resolvedRemotes).length > 0 ? resolvedRemotes : undefined,
    assets: Object.keys(basedAssets).reduce(
      (memo, hash: string) => {
        const asset = basedAssets[hash];
        const { path, extname, size } = asset;
        memo[asset.path] = { path, extname, hash: asset.hash, size };
        return memo;
      },
      {} as Record<string, SnapshotAsset>
    ),
  };
  
  console.log('[Plugin] ze-build-snapshot: Created snapshot with ID:', snapshot.snapshot_id);
  if (snapshot['zephyr:dependencies']) {
    console.log('[Plugin] ze-build-snapshot: Snapshot includes zephyr:dependencies:', snapshot['zephyr:dependencies']);
  } else {
    console.log('[Plugin] ze-build-snapshot: Snapshot has no zephyr:dependencies');
  }
  
  return snapshot;
}
