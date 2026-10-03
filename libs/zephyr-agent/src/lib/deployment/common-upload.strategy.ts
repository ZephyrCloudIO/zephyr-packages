import { zeUploadSnapshot } from '../edge-actions';
import type { UploadOptions, ZephyrEngine } from '../../zephyr-engine';
import { uploadAssets } from './upload-base/upload-assets';
import {
  createMissingAssetsHandler,
  uploadAssetsToEdge,
} from './upload-base/restore-missing-assets';
import { uploadBuildStatsAndEnableEnvs } from './upload-base/upload-build-stats-and-enable-envs';

export async function commonUploadStrategy(
  zephyr_engine: ZephyrEngine,
  { snapshot, getDashData, assets: { assetsMap, missingAssets } }: UploadOptions
): Promise<string> {
  const assetsUpload = uploadAssets(zephyr_engine, { assetsMap, missingAssets });

  const onMissingAssets = createMissingAssetsHandler(zephyr_engine, {
    assetsMap,
    // The snapshot is uploaded in parallel with the assets: let them settle first so
    // the reported hashes are not re-added to the local hash cache afterwards.
    beforeRestore: () => assetsUpload,
    uploadAssetsToEdge: (assets, edgeUrl) =>
      uploadAssetsToEdge(zephyr_engine, assets, edgeUrl),
  });

  const [versionUrl] = await Promise.all([
    zeUploadSnapshot(zephyr_engine, { snapshot, onMissingAssets }),
    assetsUpload,
  ]);

  // Waits for the reply to check upload problems, but the reply is a simply
  // 200 OK sent before any processing
  await uploadBuildStatsAndEnableEnvs(zephyr_engine, { getDashData, versionUrl });

  return versionUrl;
}
