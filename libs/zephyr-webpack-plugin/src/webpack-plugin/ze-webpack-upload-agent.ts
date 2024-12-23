import { logFn, ze_log, ZephyrError } from 'zephyr-agent';
import { XStats, XStatsCompilation } from 'zephyr-xpack-internal';
import {
  type Source,
  type ZephyrBuildStats,
  ZephyrPluginOptions,
} from 'zephyr-edge-contract';
import {
  buildWebpackAssetMap,
  emitDeploymentDone,
  getBuildStats,
} from 'zephyr-xpack-internal';
import { ZephyrWebpackInternalPluginOptions } from './ze-webpack-plugin';

export interface ZephyrAgentProps {
  stats: XStats;
  stats_json: XStatsCompilation;
  pluginOptions: ZephyrWebpackInternalPluginOptions;
  assets: Record<string, Source>;
}

export async function webpack_zephyr_agent({
  stats,
  stats_json,
  assets,
  pluginOptions,
}: ZephyrAgentProps): Promise<void> {
  ze_log('Initiating: Zephyr Webpack Upload Agent');

  const zeStart = Date.now();
  const { wait_for_index_html, zephyr_engine } = pluginOptions;
  try {
    const assetsMap = await buildWebpackAssetMap(assets, {
      wait_for_index_html,
    });

    // webpack dash data
    const { EDGE_URL, PLATFORM } = await zephyr_engine.application_configuration;

    const dashData = await getBuildStats({
      stats,
      stats_json,
      assets,
      pluginOptions,
      EDGE_URL,
      PLATFORM,
    });

    await zephyr_engine.upload_assets({
      assetsMap,
      mfConfig: pluginOptions.mfConfig as unknown as Pick<
        ZephyrPluginOptions,
        'mfConfig'
      >['mfConfig'],
      buildStats: dashData as unknown as ZephyrBuildStats,
    });
  } catch (err) {
    logFn('error', ZephyrError.format(err));
  } finally {
    emitDeploymentDone();
    // todo: log end
    ze_log('Zephyr Webpack Upload Agent: Done in', Date.now() - zeStart, 'ms');
  }
}
