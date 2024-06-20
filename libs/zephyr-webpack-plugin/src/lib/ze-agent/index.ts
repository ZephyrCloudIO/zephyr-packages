import { Stats, StatsCompilation } from 'webpack';
import {
  get_hash_list,
  get_missing_assets,
  getApplicationConfiguration,
  zeBuildAssetsMap,
  upload,
} from 'zephyr-agent';

import { Source, ze_log, ZephyrPluginOptions } from 'zephyr-edge-contract';

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
  const { EDGE_URL, DOMAIN, PLATFORM, INTEGRATION_CONFIG } = appConfig;
  const TYPE = INTEGRATION_CONFIG?.type;
  
  const zeStart = Date.now();
  const assetsMap = await zeBuildAssetsMap(pluginOptions, assets);
  const missingAssets = get_missing_assets({ assetsMap, hash_set });

  await upload({
    pluginOptions,
    assetsMap,
    missingAssets,
    getDashData: () => getDashboardData({
      stats,
      stats_json,
      assets,
      pluginOptions,
      EDGE_URL,
      DOMAIN,
      PLATFORM,
      TYPE,
    }),
    appConfig,
    zeStart,
    count: Object.keys(assets).length,
  });

  emitDeploymentDone();
}
