import {
  Snapshot,
  SnapshotUploadRes,
  ze_error,
  ze_log,
  ZeWebpackPluginOptions,
} from 'zephyr-edge-contract';
import { logger } from '../remote-logs/ze-log-event';
import { uploadSnapshot } from '../upload/upload-snapshot';

export async function zeUploadSnapshot(
  pluginOptions: ZeWebpackPluginOptions,
  snapshot: Snapshot
): Promise<SnapshotUploadRes | undefined> {
  ze_log('Uploading snapshot.');
  const { buildEnv } = pluginOptions;
  const logEvent = logger(pluginOptions);
  const snapUploadMs = Date.now();

  let error;
  const edgeTodo = await uploadSnapshot({
    body: snapshot,
    application_uid: pluginOptions.application_uid,
  }).catch((err) => {
    error = err;
    ze_error('Failed to upload snapshot', err);
  });

  if (!edgeTodo || error) {
    logEvent({
      level: 'error',
      action: 'snapshot:upload:failed',
      message: `failed uploading of ${buildEnv} snapshot to zephyr`,
    });
    ze_error('Failed to upload snapshot', error);
    return;
  }

  logEvent({
    level: 'info',
    action: 'snapshot:upload:done',
    message: `uploaded ${buildEnv} snapshot in ${Date.now() - snapUploadMs}ms`,
  });

  return edgeTodo;
}
