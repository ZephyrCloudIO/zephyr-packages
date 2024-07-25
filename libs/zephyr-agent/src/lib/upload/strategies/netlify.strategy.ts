import {
  ze_error,
  ZeApplicationConfig,
  ZeBuildAsset,
  ZeBuildAssetsMap,
  ZephyrPluginOptions,
  ZeUploadBuildStats,
} from 'zephyr-edge-contract';

import { update_hash_list } from '../../dvcs/distributed-hash-control';
import { createSnapshot, GetDashDataOptions } from '../../payload-builders';
import {
  zeEnableSnapshotOnEdge,
  zeUploadAssets,
  zeUploadBuildStats,
  zeUploadSnapshot,
} from '../../actions';
import { UploadOptions } from '../upload';

export async function netlifyStrategy({
  pluginOptions,
  getDashData,
  appConfig,
  zeStart,
  assets: { assetsMap, missingAssets, count },
}: UploadOptions): Promise<ZeUploadBuildStats | undefined> {
  const snapshot = createSnapshot({
    options: pluginOptions,
    assets: assetsMap,
    username: pluginOptions.username,
    email: appConfig.email,
  });

  await Promise.all([
    zeUploadSnapshot(pluginOptions, snapshot),
    uploadAssets({ assetsMap, missingAssets, pluginOptions, count }),
  ]);

  const envs = await uploadBuildStatsAndEnableEnvs({
    appConfig,
    pluginOptions,
    getDashData,
  });

  if (!envs) {
    ze_error('ZE20016', 'Did not receive envs from build stats upload.');

    return undefined;
  }

  await zeEnableSnapshotOnEdge({
    pluginOptions,
    envs_jwt: envs.value,
    zeStart,
  });

  return envs.value;
}

interface UploadAssetsOptions {
  assetsMap: ZeBuildAssetsMap;
  missingAssets: ZeBuildAsset[];
  pluginOptions: ZephyrPluginOptions;
  count: number;
}

async function uploadAssets({
  assetsMap,
  missingAssets,
  pluginOptions,
  count,
}: UploadAssetsOptions) {
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
  getDashData: (options: GetDashDataOptions) => unknown;
}

async function uploadBuildStatsAndEnableEnvs({
  appConfig,
  pluginOptions,
  getDashData,
}: UploadBuildStatsAndEnableEnvsOptions) {
  const dashData = getDashData({ appConfig, pluginOptions });

  return zeUploadBuildStats(dashData);
}
