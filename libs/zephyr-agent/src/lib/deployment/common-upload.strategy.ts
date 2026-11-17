import { zeUploadSnapshot } from '../edge-actions';
import type { UploadOptions, ZephyrEngine } from '../../zephyr-engine';
import { uploadAssets } from './upload-base/upload-assets';
import { uploadBuildStatsAndEnableEnvs } from './upload-base/upload-build-stats-and-enable-envs';
import { uploadStoredAssets } from './upload-base/upload-stored-assets';

export async function commonUploadStrategy(
  zephyr_engine: ZephyrEngine,
  { snapshot, getDashData, assets: { assetsMap, missingAssets } }: UploadOptions
): Promise<string> {
  // Stored objects must exist before the snapshot that points at them is published.
  const { regularAssets, storedHashes } = await uploadStoredAssets(
    zephyr_engine,
    snapshot,
    assetsMap,
    missingAssets
  );
  const [versionUrl] = await Promise.all([
    zeUploadSnapshot(zephyr_engine, { snapshot }),
    uploadAssets(zephyr_engine, {
      assetsMap,
      missingAssets: regularAssets,
      storedHashes,
    }),
  ]);

  // Waits for the reply to check upload problems, but the reply is a simply
  // 200 OK sent before any processing
  await uploadBuildStatsAndEnableEnvs(zephyr_engine, { getDashData, versionUrl });

  return versionUrl;
}
