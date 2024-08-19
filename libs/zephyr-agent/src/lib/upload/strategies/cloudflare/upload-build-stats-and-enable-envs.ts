import { ZeApplicationConfig, ZephyrBuildStats, ZephyrPluginOptions } from 'zephyr-edge-contract';
import { GetDashDataOptions } from '../../../payload-builders/ze-get-dash-data';
import { zeUploadBuildStats } from '../../../actions/ze-upload-build-stats';

interface UploadBuildStatsAndEnableEnvsOptions {
  pluginOptions: ZephyrPluginOptions;
  appConfig: ZeApplicationConfig;
  getDashData: (options: GetDashDataOptions) => ZephyrBuildStats;
  versionUrl: string;
}

export async function uploadBuildStatsAndEnableEnvs({
  appConfig,
  pluginOptions,
  getDashData,
  versionUrl,
}: UploadBuildStatsAndEnableEnvsOptions) {
  const dashData = getDashData({ appConfig, pluginOptions });
  dashData.edge.versionUrl = versionUrl;

  return zeUploadBuildStats(dashData);
}
