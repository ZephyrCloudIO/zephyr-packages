import {
  green,
  yellow,
  ze_error,
  type Snapshot,
  type ZephyrPluginOptions,
  ZeApplicationConfig,
  brightBlueBgName,
  cyanBright,
} from 'zephyr-edge-contract';
import { logger } from '../remote-logs/ze-log-event';
import { uploadSnapshot } from '../upload/upload-snapshot';
import { ConfigurationError } from '../custom-errors';
import { SnapshotUploadFailureError, SnapshotUploadNoResultError } from '../custom-errors/snapshot-uploads';

export async function zeUploadSnapshot(props: {
  pluginOptions: ZephyrPluginOptions;
  snapshot: Snapshot;
  appConfig: ZeApplicationConfig;
}): Promise<string> {
  const { pluginOptions, snapshot } = props;
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

  if (!edgeTodo) ze_error('ERR_SNAPSHOT_UPLOADS_NO_RESULTS', 'Snapshot upload gave no result, exiting...\n');

  logEvent({
    level: 'trace',
    action: 'deploy:url',
    message: `Deploying to edge: ${brightBlueBgName}  -> ${cyanBright(versionUrl)}`,
  });

  return versionUrl;
}
