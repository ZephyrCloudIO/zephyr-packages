import { zeUploadSnapshot } from '../edge-actions';
import type { UploadOptions, ZephyrEngine } from '../../zephyr-engine';
import { uploadAssets } from './upload-base/upload-assets';
import { uploadBuildStatsAndEnableEnvs } from './upload-base/upload-build-stats-and-enable-envs';

export async function commonUploadStrategy(
  zephyr_engine: ZephyrEngine,
  { snapshot, getDashData, assets: { assetsMap, missingAssets } }: UploadOptions
): Promise<string> {
  const [versionUrl] = await Promise.all([
    zeUploadSnapshot(zephyr_engine, { snapshot }),
    uploadAssets(zephyr_engine, { assetsMap, missingAssets }),
  ]);

  // Waits for the API's upload decision: when permission profiles are enforced and the
  // API answers in time, the reply carries `outcome`, and a denied deploy throws ZE10038
  await uploadBuildStatsAndEnableEnvs(zephyr_engine, { getDashData, versionUrl });

  return versionUrl;
}
