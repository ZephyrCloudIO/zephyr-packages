import { Stats, StatsCompilation } from 'webpack';
import {
  createSnapshot,
  get_hash_list,
  get_missing_assets,
  getApplicationConfiguration,
  logger,
  update_hash_list,
  zeBuildAssetsMap,
  zeEnableSnapshotOnEdge,
  zeUploadAssets,
  zeUploadBuildStats,
  zeUploadSnapshot,
} from 'zephyr-agent';

import {
  Source,
  ze_error,
  ze_log,
  ZephyrPluginOptions,
} from 'zephyr-edge-contract';

import { emitDeploymentDone } from './lifecycle-events';
import { getDashboardData } from '../../federation-dashboard-legacy/get-dashboard-data';

export interface ZephyrAgentProps {
  stats: Stats;
  stats_json: StatsCompilation;
  pluginOptions: ZephyrPluginOptions;
  assets: Record<string, Source>;
}

export async function webpack_zephyr_agent({
  stats,
  stats_json,
  assets,
  pluginOptions,
}: ZephyrAgentProps): Promise<void> {
  ze_log('zephyr agent started.');
  const application_uid = pluginOptions.application_uid;

  const [appConfig, hash_set] = await Promise.all([
    getApplicationConfiguration({ application_uid }),
    get_hash_list(application_uid),
  ]);
  const { EDGE_URL, username, email } = appConfig;

  const zeStart = Date.now();
  const assetsMap = await zeBuildAssetsMap(pluginOptions, assets);
  const snapshot = createSnapshot({
    options: pluginOptions,
    assets: assetsMap,
    username,
    email,
  });

  await zeUploadSnapshot(pluginOptions, snapshot).catch((err) =>
    ze_error('Failed to upload snapshot.', err)
  );

  const missingAssets = get_missing_assets({ assetsMap, hash_set });

  const assetsUploadSuccess = await zeUploadAssets(pluginOptions, {
    missingAssets,
    assetsMap,
    count: Object.keys(assets).length,
  });

  if (!assetsUploadSuccess)
    return ze_error('Failed to upload assets.', assetsUploadSuccess);

  if (missingAssets.length) {
    await update_hash_list(application_uid, assetsMap);
  }

  const dashData = getDashboardData({
    stats,
    stats_json,
    assets,
    pluginOptions,
    EDGE_URL,
  });

  const envs = await zeUploadBuildStats(dashData);
  if (!envs)
    return ze_error('Did not receive envs from build stats upload. Exiting.');

  await zeEnableSnapshotOnEdge({
    pluginOptions,
    envs_jwt: envs.value,
    zeStart,
  });

  emitDeploymentDone();
}
