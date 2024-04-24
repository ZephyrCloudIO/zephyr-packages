import {
  createFullAppName,
  createSnapshotId,
  Snapshot,
  SnapshotAsset,
  ze_log,
  ZeBuildAssetsMap,
  ZeWebpackPluginOptions,
} from 'zephyr-edge-contract';
import * as isCI from 'is-ci';

export function createSnapshot({
  options,
  assets,
  username,
  email,
}: {
  options: ZeWebpackPluginOptions;
  assets: ZeBuildAssetsMap;
  username: string;
  email: string;
}): Snapshot {
  ze_log('Creating snapshot object.');
  const version_postfix = isCI
    ? `${options.git.branch}.${options.zeConfig.buildId}`
    : `${options.zeConfig.user}.${options.zeConfig.buildId}`;
  return {
    application_uid: createFullAppName(options.app),
    version: `${options.app.version}-${version_postfix}`,
    snapshot_id: createSnapshotId(options),
    domain: options.zeConfig.edge_url,
    uid: {
      build: options.zeConfig.buildId!,
      app_name: options.app.name,
      repo: options.app.project,
      org: options.app.org,
    },
    git: options.git,
    creator: {
      name: username,
      email,
    },
    createdAt: Date.now(),
    mfConfig: options.mfConfig,
    assets: Object.keys(assets).reduce(
      (memo, hash: string) => {
        const asset = assets[hash];
        const { path, extname, size } = asset;
        memo[asset.path] = { path, extname, hash: asset.hash, size };
        return memo;
      },
      {} as Record<string, SnapshotAsset>
    ),
  };
}
