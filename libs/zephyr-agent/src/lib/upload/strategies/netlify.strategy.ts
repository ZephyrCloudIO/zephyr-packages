import type { ZeApplicationConfig, ZeBuildAsset, ZeBuildAssetsMap, ZephyrBuildStats, ZephyrPluginOptions } from 'zephyr-edge-contract';
import { zeUploadAssets, zeUploadBuildStats, zeUploadSnapshot } from '../../actions';
import { update_hash_list } from '../../dvcs/distributed-hash-control';
import { type GetDashDataOptions, createSnapshot } from '../../payload-builders';
import type { UploadOptions } from '../upload';

export async function netlifyStrategy({
  pluginOptions,
  getDashData,
  appConfig,
  assets: { assetsMap, missingAssets, count },
}: UploadOptions) {
  const snapshot = createSnapshot({
    options: pluginOptions,
    assets: assetsMap,
    username: pluginOptions.username,
    email: appConfig.email,
  });

  const [versionUrl] = await Promise.all([
    zeUploadSnapshot({ pluginOptions, snapshot, appConfig }),
    uploadAssets({ assetsMap, missingAssets, pluginOptions, count }),
  ]);

  // Waits for the reply to check upload problems, but the reply is a simply
  // 200 OK sent before any processing
  await uploadBuildStatsAndEnableEnvs({
    appConfig,
    pluginOptions,
    getDashData,
    versionUrl,
  });

  return versionUrl;
}

interface UploadAssetsOptions {
  assetsMap: ZeBuildAssetsMap;
  missingAssets: ZeBuildAsset[];
  pluginOptions: ZephyrPluginOptions;
  count: number;
}

async function uploadAssets({ assetsMap, missingAssets, pluginOptions, count }: UploadAssetsOptions) {
  const upload_success = await zeUploadAssets(pluginOptions, {
    missingAssets,
    assetsMap,
    count,
  });
  if (upload_success && missingAssets.length) {
    await update_hash_list(pluginOptions.application_uid, assetsMap);
  }

  return upload_success;
}

interface UploadBuildStatsAndEnableEnvsOptions {
  pluginOptions: ZephyrPluginOptions;
  appConfig: ZeApplicationConfig;
  getDashData: (options: GetDashDataOptions) => ZephyrBuildStats;
  versionUrl: string;
}

async function uploadBuildStatsAndEnableEnvs({ appConfig, pluginOptions, getDashData, versionUrl }: UploadBuildStatsAndEnableEnvsOptions) {
  const dashData = getDashData({ appConfig, pluginOptions });
  dashData.edge.versionUrl = versionUrl;

  return zeUploadBuildStats(dashData);
}
