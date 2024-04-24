import {
  Snapshot,
  ze_log,
  ZeUploadBuildStats,
  ZeWebpackPluginOptions,
} from 'zephyr-edge-contract';
import { logger } from '../remote-logs/ze-log-event';
import { uploadEnvs } from '../upload/upload-envs';

export async function zeEnableSnapshotOnEdge(
  pluginOptions: ZeWebpackPluginOptions,
  snapshot: Snapshot,
  envs_jwt: ZeUploadBuildStats
): Promise<void> {
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

  ze_log('Build successfully deployed to edge');
}
