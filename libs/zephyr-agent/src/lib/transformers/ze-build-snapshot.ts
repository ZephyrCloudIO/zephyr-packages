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

  // Check if zephyr-manifest.json exists in the assets
  let manifestReference: { filename: string; remotes?: string[] } | undefined;
  
  const manifestAsset = Object.values(basedAssets).find(asset => asset.path === 'zephyr-manifest.json');
  
  if (manifestAsset && zephyr_engine.federated_dependencies && zephyr_engine.federated_dependencies.length > 0) {
    console.log('[Zephyr Build] Found zephyr-manifest.json in assets');
    manifestReference = {
      filename: 'zephyr-manifest.json',
      remotes: zephyr_engine.federated_dependencies.map(dep => dep.name),
    };
    console.log('[Zephyr Build] Created manifest reference:', manifestReference);
  } else {
    console.log('[Zephyr Build] No manifest file found in assets or no federated dependencies');
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
        memo[asset.path] = { path, extname, hash: asset.hash, size };
        return memo;
      },
      {} as Record<string, SnapshotAsset>
    ),
  };
  
  // Add the manifest reference as a custom field
  // We'll use a type assertion to bypass the type check for now
  (snapshot as any)['zephyr:dependencies'] = manifestReference;
  
  console.log('[Plugin] ze-build-snapshot: Created snapshot with ID:', snapshot.snapshot_id);
  if (manifestReference) {
    console.log('[Plugin] ze-build-snapshot: Snapshot includes manifest reference:', manifestReference);
  } else {
    console.log('[Plugin] ze-build-snapshot: Snapshot has no manifest reference');
  }
  
  return snapshot;
}
