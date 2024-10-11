import {
  type Snapshot,
  type ZeApplicationConfig,
  ZeErrors,
  ZephyrError,
  type ZephyrPluginOptions,
  green,
  yellow,
} from 'zephyr-edge-contract';
import { logger } from '../remote-logs/ze-log-event';
import { uploadSnapshot } from '../upload/upload-snapshot';

export async function zeUploadSnapshot(props: {
  pluginOptions: ZephyrPluginOptions;
  snapshot: Snapshot;
  appConfig: ZeApplicationConfig;
}): Promise<string> {
  const { pluginOptions, snapshot } = props;
  const { buildEnv } = pluginOptions;
  const logEvent = logger(pluginOptions);
  const snapUploadMs = Date.now();

  const edgeTodo = await uploadSnapshot({
    body: snapshot,
    application_uid: pluginOptions.application_uid,
  });

  const versionUrl = edgeTodo?.urls?.version;

  if (!versionUrl) {
    logEvent({
      level: 'error',
      action: 'snapshot:upload:failed',
      message: `failed uploading of ${buildEnv} snapshot to zephyr`,
    });

    throw new ZephyrError(ZeErrors.ERR_SNAPSHOT_UPLOADS_NO_RESULTS);
  }

  logEvent({
    level: 'info',
    action: 'snapshot:upload:done',
    message: `Uploaded ${green(buildEnv)} snapshot in ${yellow(`${Date.now() - snapUploadMs}`)}ms`,
  });

  return versionUrl;
}
