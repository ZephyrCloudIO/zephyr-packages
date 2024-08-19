import * as process from 'process';

import { yellow, ZeUploadBuildStats } from 'zephyr-edge-contract';

import { createSnapshot } from '../../payload-builders';
import { zeUploadSnapshot } from '../../actions';
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

  const [versionUrl] = await Promise.all([
    zeUploadSnapshot({ pluginOptions, snapshot, appConfig }),
    uploadAssets({ assetsMap, missingAssets, pluginOptions, count }),
  ]);

  process.nextTick(() =>
    uploadBuildStatsAndEnableEnvs({
      appConfig,
      pluginOptions,
      getDashData,
      versionUrl,
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
