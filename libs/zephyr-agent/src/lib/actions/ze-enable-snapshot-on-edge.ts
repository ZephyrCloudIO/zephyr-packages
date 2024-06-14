import {
  Snapshot,
  ze_log,
  ZeUploadBuildStats,
  ZephyrPluginOptions,
} from 'zephyr-edge-contract';
import { logger } from '../remote-logs/ze-log-event';
import { uploadEnvs } from '../upload/upload-envs';

interface ZeEnableSnapshotOnEdgeProps {
  pluginOptions: ZephyrPluginOptions,
  envs_jwt: ZeUploadBuildStats,
  zeStart: number
}
export async function zeEnableSnapshotOnEdge(props: ZeEnableSnapshotOnEdgeProps): Promise<void> {
  const { pluginOptions, envs_jwt, zeStart } = props;

  ze_log('Enabling snapshot on edge');
  const logEvent = logger(pluginOptions);

  envs_jwt.urls.forEach((url) => {
    logEvent({
      level: 'trace',
      action: 'deploy:url',
      message: `deploying to ${url}`,
    });
  });

  const latest = await uploadEnvs({
    body: envs_jwt,
    application_uid: pluginOptions.application_uid,
  });

  if (!latest) {
    logEvent({
      level: 'error',
      action: 'deploy:edge:failed',
      message: `failed deploying local build to edge`,
    });
    return;
  }


  logEvent({
    level: 'info',
    action: 'build:deploy:done',
    message: `build deployed in ${Date.now() - zeStart}ms`,
  });

  ze_log('Build successfully deployed to edge');
}
