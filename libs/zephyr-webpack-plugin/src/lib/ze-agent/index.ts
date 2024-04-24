import { Stats, StatsCompilation } from 'webpack';
import {
  createSnapshot,
  getApplicationConfiguration,
  logger,
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
  ZeWebpackPluginOptions,
} from 'zephyr-edge-contract';

import { emitDeploymentDone } from './lifecycle-events';
import { getDashboardData } from '../../federation-dashboard-legacy/get-dashboard-data';

export interface ZephyrAgentProps {
  stats: Stats;
  stats_json: StatsCompilation;
  pluginOptions: ZeWebpackPluginOptions;
  assets: Record<string, Source>;
}

export async function zephyr_agent({
  stats,
  stats_json,
  assets,
  pluginOptions,
}: ZephyrAgentProps): Promise<void> {
  ze_log('zephyr agent started.');
  const logEvent = logger(pluginOptions);
  const { EDGE_URL, username, email } = await getApplicationConfiguration({
    application_uid: pluginOptions.application_uid,
  });

  const zeStart = Date.now();
  const assetsMap = await zeBuildAssetsMap(pluginOptions, assets);
  const snapshot = createSnapshot({
    options: pluginOptions,
    assets: assetsMap,
    username,
    email,
  });

  const missingAssets = await zeUploadSnapshot(pluginOptions, snapshot).catch(
    (err) => ze_error('Failed to upload snapshot.', err)
  );

  if (typeof missingAssets === 'undefined')
    return ze_error('Snapshot upload gave no result, exiting');

  const assetsUploadSuccess = await zeUploadAssets(pluginOptions, {
    missingAssets,
    assetsMap,
    count: Object.keys(assets).length,
  });

  if (!assetsUploadSuccess)
    return ze_error('Failed to upload assets.', assetsUploadSuccess);

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

  await zeEnableSnapshotOnEdge(pluginOptions, snapshot, envs.value);

  logEvent({
    level: 'info',
    action: 'build:deploy:done',
    message: `build deployed in ${Date.now() - zeStart}ms`,
  });

  emitDeploymentDone();
}
