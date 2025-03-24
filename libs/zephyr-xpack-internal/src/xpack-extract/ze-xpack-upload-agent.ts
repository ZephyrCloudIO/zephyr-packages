import { logFn, ze_log, ZephyrEngine, ZephyrError } from 'zephyr-agent';
import {
  type Source,
  type ZephyrBuildStats,
  ZephyrPluginOptions,
} from 'zephyr-edge-contract';
import { ModuleFederationPlugin, XStats, XStatsCompilation } from '../xpack.types';
import { buildWebpackAssetMap } from '../xpack-extract/build-webpack-assets-map';
import { emitDeploymentDone } from '../lifecycle-events/index';
import { getBuildStats } from '../federation-dashboard-legacy/get-build-stats';

interface UploadAgentPluginOptions {
  zephyr_engine: ZephyrEngine;
  wait_for_index_html?: boolean;
  // federated module config
  mfConfig: ModuleFederationPlugin[] | ModuleFederationPlugin | undefined;
}

export interface ZephyrAgentProps<T> {
  stats: XStats;
  stats_json: XStatsCompilation;
  pluginOptions: T;
  assets: Record<string, Source>;
}

export async function xpack_zephyr_agent<T extends UploadAgentPluginOptions>({
  stats,
  stats_json,
  assets,
  pluginOptions,
}: ZephyrAgentProps<T>): Promise<void> {
  ze_log('Initiating: Zephyr Webpack Upload Agent');

  const zeStart = Date.now();
  const { wait_for_index_html, zephyr_engine } = pluginOptions;

  try {
    const assetsMap = await buildWebpackAssetMap(assets, {
      wait_for_index_html,
      zephyr_engine,
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
