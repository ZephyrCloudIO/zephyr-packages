import type { ZephyrEngine } from 'zephyr-agent';
import { logFn, ze_log, ZephyrError } from 'zephyr-agent';
import type { ZephyrPluginOptions } from 'zephyr-edge-contract';
import { type Source, type ZephyrBuildStats } from 'zephyr-edge-contract';
import { getBuildStats } from '../federation-dashboard-legacy/get-build-stats';
import { emitDeploymentDone } from '../lifecycle-events/index';
import { buildWebpackAssetMap } from '../xpack-extract/build-webpack-assets-map';
import type { ModuleFederationPlugin, XStats, XStatsCompilation } from '../xpack.types';
import type { ZephyrBuildHooks } from 'zephyr-agent';

interface UploadAgentPluginOptions {
  zephyr_engine: ZephyrEngine;
  wait_for_index_html?: boolean;
  // federated module config
  mfConfig: ModuleFederationPlugin[] | ModuleFederationPlugin | undefined;
  hooks?: ZephyrBuildHooks;
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
  ze_log.init('Initiating: Zephyr Webpack Upload Agent');

  const zeStart = Date.now();
  const { wait_for_index_html, zephyr_engine } = pluginOptions;

  try {
    const assetsMap = await buildWebpackAssetMap(assets, {
      wait_for_index_html,
    });

    // webpack dash data
    const { EDGE_URL, PLATFORM, DELIMITER } =
      await zephyr_engine.application_configuration;

    const dashData = await getBuildStats({
      stats,
      stats_json,
      assets,
      pluginOptions,
      EDGE_URL,
      PLATFORM,
      DELIMITER,
    });

    await zephyr_engine.upload_assets({
      assetsMap,
      mfConfig: pluginOptions.mfConfig as unknown as Pick<
        ZephyrPluginOptions,
        'mfConfig'
      >['mfConfig'],
      buildStats: dashData as unknown as ZephyrBuildStats,
      hooks: pluginOptions.hooks,
    });
  } catch (err) {
    logFn('error', ZephyrError.format(err));
  } finally {
    emitDeploymentDone();
    ze_log.upload('Zephyr Webpack Upload Agent: Done in', Date.now() - zeStart, 'ms');
  }
}
