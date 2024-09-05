import { type Snapshot, type ZeApplicationConfig, type ZephyrPluginOptions, gray, green, yellow, ze_error } from 'zephyr-edge-contract';
import { SnapshotUploadFailureError, SnapshotUploadNoResultError } from '../custom-errors/snapshot-uploads';
import { logger } from '../remote-logs/ze-log-event';
import { uploadSnapshot } from '../upload/upload-snapshot';
import { PromiseTuple } from '../util/promise';

export async function zeUploadSnapshot(props: {
  pluginOptions: ZephyrPluginOptions;
  snapshot: Snapshot;
  appConfig: ZeApplicationConfig;
}): Promise<string> {
  const { pluginOptions, snapshot } = props;
  const { buildEnv } = pluginOptions;
  const logEvent = logger(pluginOptions);
  const snapUploadMs = Date.now();

  const [error, edgeTodo] = await PromiseTuple(
    uploadSnapshot({
      body: snapshot,
      application_uid: pluginOptions.application_uid,
    })
  );

  const versionUrl = edgeTodo?.urls?.version;

  if (!versionUrl || error) {
    logEvent({
      level: 'error',
      action: 'snapshot:upload:failed',
      message: `failed uploading of ${buildEnv} snapshot to zephyr`,
    });

    if (error) {
      ze_error('ERR_SNAPSHOT_UPLOADS_NO_RESULTS');
      throw new SnapshotUploadNoResultError();
    }

    ze_error('ERR_FAILED_UPLOAD_SNAPSHOTS', 'Failed to upload snapshot.', error);
    throw new SnapshotUploadFailureError();
  }

  logEvent({
    level: 'info',
    action: 'snapshot:upload:done',
    message: `Uploaded ${green(buildEnv)} snapshot in ${yellow(`${Date.now() - snapUploadMs}`)}ms`,
  });

  if (!edgeTodo) {
    ze_error('ERR_SNAPSHOT_UPLOADS_NO_RESULTS', 'Snapshot upload gave no result, exiting...\n');
  }

  logEvent({
    level: 'trace',
    action: 'deploy:url',
    message: `Deployment available at ${gray(versionUrl)}!`,
  });

  return versionUrl;
}
