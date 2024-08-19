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
      ze_error('ZE10018', 'Failed to upload snapshot.', error);
      throw new Error('Error [ZE10018]: Failed to upload snapshot.');
    }
    ze_error('ZE10018', 'Snapshot upload gave no result, exiting...');
    throw new Error('Error [ZE10019]: Snapshot upload gave no result, exiting...');
  }

  logEvent({
    level: 'info',
    action: 'snapshot:upload:done',
    message: `Uploaded ${green(buildEnv)} snapshot in ${yellow(`${Date.now() - snapUploadMs}`)}ms`,
  });

  logEvent({
    level: 'trace',
    action: 'deploy:url',
    message: `Deploying to edge: ${brightBlueBgName}  -> ${cyanBright(versionUrl)}`,
  });

  return versionUrl;
}
