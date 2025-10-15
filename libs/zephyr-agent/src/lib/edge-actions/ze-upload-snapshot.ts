import { type Snapshot } from 'zephyr-edge-contract';
import type { ZephyrEngine } from '../../zephyr-engine';
import { ZeErrors, ZephyrError } from '../errors';
import { uploadSnapshot } from '../http/upload-snapshot';
import { green, yellow } from '../logging/picocolor';

interface ZeUploadSnapshotProps {
  snapshot: Snapshot;
}

export async function zeUploadSnapshot(
  zephyr_engine: ZephyrEngine,
  { snapshot }: ZeUploadSnapshotProps
): Promise<string> {
  const zeStart = Date.now();
  const application_uid = zephyr_engine.application_uid;
  const logger = await zephyr_engine.logger;
  const buildEnv = zephyr_engine.env.isCI ? 'ci' : 'local';

  const edgeTodo = await uploadSnapshot({
    body: snapshot,
    application_uid,
  });

  // Log payload shape in development builds for OTA contract clarity
  if (buildEnv === 'local' && zephyr_engine.env.isDev) {
    logger({
      level: 'info',
      action: 'snapshot:upload:payload-shape',
      message: 'Upload response structure for OTA contract reference',
      data: {
        urls: edgeTodo?.urls ? Object.keys(edgeTodo.urls) : [],
        hasVersionUrl: !!edgeTodo?.urls?.version,
        manifestCoupling: 'version URL immutably linked to zephyr-manifest.json',
        otaContract: {
          versionUrl: edgeTodo?.urls?.version,
          manifestPath: 'zephyr-manifest.json',
          coupling: 'immutable - version URL + manifest must match for OTA updates',
        },
      },
    });
  }

  const versionUrl = edgeTodo?.urls?.version;

  if (!versionUrl) {
    logger({
      level: 'error',
      action: 'snapshot:upload:failed',
      message: `failed uploading of ${buildEnv} snapshot to zephyr`,
    });

    throw new ZephyrError(ZeErrors.ERR_SNAPSHOT_UPLOADS_NO_RESULTS);
  }

  logger({
    level: 'info',
    action: 'snapshot:upload:done',
    message: `Uploaded ${green(buildEnv)} snapshot in ${yellow(`${Date.now() - zeStart}`)}ms`,
  });

  return versionUrl;
}
