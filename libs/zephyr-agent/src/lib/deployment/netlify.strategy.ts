import { zeUploadSnapshot } from '../edge-actions';
import type { UploadOptions, ZephyrEngine } from '../../zephyr-engine';
import { uploadAssets } from './upload-base/upload-assets';
import { uploadBuildStatsAndEnableEnvs } from './upload-base/upload-build-stats-and-enable-envs';

export async function netlifyStrategy(
  zephyr_engine: ZephyrEngine,
  { snapshot, getDashData, assets: { assetsMap, missingAssets } }: UploadOptions
) {
  const [versionUrl] = await Promise.all([
    zeUploadSnapshot(zephyr_engine, { snapshot }),
    uploadAssets(zephyr_engine, { assetsMap, missingAssets }),
  ]);

  // Waits for the reply to check upload problems, but the reply is a simply
  // 200 OK sent before any processing
  await uploadBuildStatsAndEnableEnvs(zephyr_engine, { getDashData, versionUrl });

  return versionUrl;
}
