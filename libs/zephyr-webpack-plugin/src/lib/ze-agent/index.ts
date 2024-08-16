import { Stats, StatsCompilation } from 'webpack';
import { get_hash_list, get_missing_assets, getApplicationConfiguration, upload, zeBuildAssetsMap } from 'zephyr-agent';

import { Source, ze_log, ZephyrPluginOptions } from 'zephyr-edge-contract';

import { emitDeploymentDone } from './lifecycle-events';
import { getBuildStats } from '../../federation-dashboard-legacy/get-build-stats';

export interface ZephyrAgentProps {
  stats: Stats;
  stats_json: StatsCompilation;
  pluginOptions: ZephyrPluginOptions;
  assets: Record<string, Source>;
}

export async function webpack_zephyr_agent({ stats, stats_json, assets, pluginOptions }: ZephyrAgentProps): Promise<void> {
  ze_log('zephyr agent started.');
  const application_uid = pluginOptions.application_uid;

  const [appConfig, hash_set] = await Promise.all([getApplicationConfiguration({ application_uid }), get_hash_list(application_uid)]);
  const { EDGE_URL, DOMAIN, PLATFORM, INTEGRATION_CONFIG } = appConfig;
  const TYPE = INTEGRATION_CONFIG?.type;

  const zeStart = Date.now();
  const assetsMap = await zeBuildAssetsMap(pluginOptions, assets);
  const missingAssets = get_missing_assets({ assetsMap, hash_set });

  await upload({
    pluginOptions,
    assets: {
      assetsMap,
      missingAssets,
      outputPath: pluginOptions.outputPath as string,
      count: Object.keys(assets).length,
    },
    getDashData: () =>
      // fix: this is bad ts-expect-error
      // @ts-expect-error Type 'ConvertedGraph' is missing the following properties from type 'ZephyrBuildStats': project, tags, app, git, and 3 more.
      getBuildStats({
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
    uploadConfig: appConfig.uploadConfig,
  });

  emitDeploymentDone();
}
