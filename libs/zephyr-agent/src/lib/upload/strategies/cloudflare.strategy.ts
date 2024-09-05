import { zeUploadSnapshot } from '../../actions';
import { createSnapshot } from '../../payload-builders';
import type { UploadOptions } from '../upload';
import { uploadAssets, uploadBuildStatsAndEnableEnvs } from './cloudflare';

export async function cloudflareStrategy({
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
}
