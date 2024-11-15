import { zeUploadSnapshot } from '../edge-actions';
import { UploadOptions, ZephyrEngine } from '../../zephyr-engine';
import { uploadAssets } from './upload-base/upload-assets';
import { uploadBuildStatsAndEnableEnvs } from './upload-base/upload-build-stats-and-enable-envs';

export async function fastlyStrategy(
  zephyr_engine: ZephyrEngine,
  upload_options: UploadOptions
): Promise<string> {
  const {
    snapshot,
    getDashData,
    assets: { assetsMap, missingAssets },
  } = upload_options;
  const [versionUrl] = await Promise.all([
    zeUploadSnapshot(zephyr_engine, { snapshot }),
    uploadAssets(zephyr_engine, { assetsMap, missingAssets }),
  ]);

  // Waits for the reply to check upload problems, but the reply is a simply
  // 200 OK sent before any processing
  await uploadBuildStatsAndEnableEnvs(zephyr_engine, { getDashData, versionUrl });

  return versionUrl;
}
