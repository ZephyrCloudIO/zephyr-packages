import * as process from 'process';
import { access, constants, mkdir, writeFile } from 'fs/promises';
import { dirname, sep } from 'path';

import {
  blackBright,
  brightBlueBgName,
  CloudflareOptions,
  cyanBright,
  UploadProviderConfig,
  yellow,
  ze_error,
  ze_log,
  ZeApplicationConfig,
  ZeBuildAsset,
  ZeBuildAssetsMap,
  ZephyrPluginOptions,
  ZeUploadBuildStats,
} from 'zephyr-edge-contract';

import { update_hash_list } from '../../dvcs/distributed-hash-control';
import { createSnapshot, GetDashDataOptions } from '../../payload-builders';
import { zeEnableSnapshotOnEdge, zeEnableSnapshotOnPages, zeUploadAssets, zeUploadBuildStats, zeUploadSnapshot } from '../../actions';
import { UploadOptions } from '../upload';
import { uploadAssets, uploadBuildStatsAndEnableEnvs } from './cloudflare';
import { logger } from '../../remote-logs/ze-log-event';

export async function cloudflareStrategy({
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
    zeUploadSnapshot({ pluginOptions, snapshot, appConfig }),
    uploadAssets({ assetsMap, missingAssets, pluginOptions, count }),
  ]);

  process.nextTick(() =>
    uploadBuildStatsAndEnableEnvs({
      appConfig,
      pluginOptions,
      getDashData,
    })
  );

  logger(pluginOptions)({
    level: 'info',
    action: 'build:deploy:done',
    message: `Build deployed in ${yellow(`${Date.now() - zeStart}`)}ms`,
  });

  return;
}

// @todo: should be moved to deployment worker
/*  await zeEnableSnapshotOnEdge({
    pluginOptions,
    envs_jwt: envs.value,
    zeStart,
  });

  await uploadToPages({
    uploadConfig,
    pluginOptions,
    outputPath,
    assetsMap,
    envs: envs.value,
  });*/
