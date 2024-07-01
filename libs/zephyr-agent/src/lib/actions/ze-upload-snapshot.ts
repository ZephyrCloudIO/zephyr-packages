import {
  Snapshot,
  SnapshotUploadRes,
  ze_error,
  ZephyrPluginOptions,
} from 'zephyr-edge-contract';
import { logger } from '../remote-logs/ze-log-event';
import { uploadSnapshot } from '../upload/upload-snapshot';

export async function zeUploadSnapshot(
  pluginOptions: ZephyrPluginOptions,
  snapshot: Snapshot
): Promise<SnapshotUploadRes | undefined> {
  const { buildEnv } = pluginOptions;
  const logEvent = logger(pluginOptions);
  const snapUploadMs = Date.now();

  let error;
  const edgeTodo = await uploadSnapshot({
    body: snapshot,
    application_uid: pluginOptions.application_uid,
  }).catch((err) => {
    error = err;
  });

  if (!edgeTodo || error) {
    logEvent({
      level: 'error',
      action: 'snapshot:upload:failed',
      message: `failed uploading of ${buildEnv} snapshot to zephyr`,
    });
    ze_error("DE10018", 'Failed to upload snapshot.', error);
    return;
  }

  logEvent({
    level: 'info',
    action: 'snapshot:upload:done',
    message: `uploaded ${buildEnv} snapshot in ${Date.now() - snapUploadMs}ms`,
  });

  if (!edgeTodo)
    ze_error("DE10019", 'Snapshot upload gave no result, exiting...\n')

  return edgeTodo;
}
