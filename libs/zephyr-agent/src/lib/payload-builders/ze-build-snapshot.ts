import {
  createApplicationUID,
  createSnapshotId,
  Snapshot,
  SnapshotAsset,
  ZeBuildAssetsMap,
  ZephyrPluginOptions,
} from 'zephyr-edge-contract';
import * as isCI from 'is-ci';

export function createSnapshot({
  options,
  assets,
  username,
  email,
}: {
  options: ZephyrPluginOptions;
  assets: ZeBuildAssetsMap;
  username: string;
  email: string;
}): Snapshot {
  const version_postfix = isCI
    ? `${options.git.branch}.${options.zeConfig.buildId}`
    : `${options.zeConfig.user}.${options.zeConfig.buildId}`;
  return {
    application_uid: createApplicationUID(options.app),
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
