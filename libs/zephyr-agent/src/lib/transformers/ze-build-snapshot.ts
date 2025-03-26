import {
  createApplicationUid,
  flatCreateSnapshotId,
  Snapshot,
  SnapshotAsset,
  ZeBuildAssetsMap,
  ZephyrPluginOptions,
} from 'zephyr-edge-contract';
import { ZephyrEngine } from '../../zephyr-engine';
import { normalizeBasePath } from './ze-basehref-handler';

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
    throw new Error(`Can't createSnapshot() without buildId`);
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

  const normalizedBasePath = normalizeBasePath(zephyr_engine.buildProperties.baseHref);
  
  return {
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
    assets: Object.keys(assets).reduce(
      (memo, hash: string) => {
        const asset = assets[hash];
        const { path, extname, size } = asset;
        // path prefixed with basehref from plugin config like https://webpack.js.org/guides/public-path/
        const pathBaseHref = path === 'index.html' ? path : `${normalizedBasePath}/${path}`;
        memo[pathBaseHref] = {
          path: pathBaseHref,
          extname,
          hash: asset.hash,
          size,
        };
        return memo;
      },
      {} as Record<string, SnapshotAsset>
    ),
  };
}
