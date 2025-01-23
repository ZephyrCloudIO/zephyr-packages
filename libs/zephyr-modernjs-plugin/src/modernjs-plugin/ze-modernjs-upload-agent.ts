import { logFn, ze_log, ZephyrError } from 'zephyr-agent';
import {
  type Source,
  type ZephyrBuildStats,
  ZephyrPluginOptions,
} from 'zephyr-edge-contract';
import { Stats, StatsCompilation } from '@rspack/core';
import { ZephyrModernjsInternalPluginOptions } from './ze-modernjs-plugin';
import {
  buildWebpackAssetMap,
  emitDeploymentDone,
  getBuildStats,
} from 'zephyr-xpack-internal';

export interface ZephyrAgentProps {
  stats: Stats;
  stats_json: StatsCompilation;
  pluginOptions: ZephyrModernjsInternalPluginOptions;
  assets: Record<string, Source>;
}

export async function modernjs_zephyr_agent({
  stats,
  stats_json,
  assets,
  pluginOptions,
}: ZephyrAgentProps): Promise<void> {
  ze_log('Initiating: Zephyr Modernjs Upload Agent');

  const zeStart = Date.now();
  const { wait_for_index_html, zephyr_engine } = pluginOptions;

  try {
    const assetsMap = await buildWebpackAssetMap(assets, {
      wait_for_index_html,
    });

    // rspack dash data
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
    ze_log('Zephyr Rspack Upload Agent: Done in', Date.now() - zeStart, 'ms');
  }
}
