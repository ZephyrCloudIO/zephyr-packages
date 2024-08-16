import { ZeApplicationConfig, ZephyrBuildStats, ZephyrPluginOptions } from 'zephyr-edge-contract';
import { GetDashDataOptions } from '../../../payload-builders/ze-get-dash-data';
import { zeUploadBuildStats } from '../../../actions/ze-upload-build-stats';

interface UploadBuildStatsAndEnableEnvsOptions {
  pluginOptions: ZephyrPluginOptions;
  appConfig: ZeApplicationConfig;
  getDashData: (options: GetDashDataOptions) => ZephyrBuildStats;
}

export async function uploadBuildStatsAndEnableEnvs({ appConfig, pluginOptions, getDashData }: UploadBuildStatsAndEnableEnvsOptions) {
  const dashData = getDashData({ appConfig, pluginOptions });

  return zeUploadBuildStats(dashData);
}
