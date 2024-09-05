import {
  type ZeUploadBuildStats,
  type ZephyrPluginOptions,
  blackBright,
  brightBlueBgName,
  cyanBright,
  yellow,
  ze_log,
} from 'zephyr-edge-contract';
import { logger } from '../remote-logs/ze-log-event';
import { uploadEnvs } from '../upload/upload-envs';

interface ZeEnableSnapshotOnEdgeProps {
  pluginOptions: ZephyrPluginOptions;
  envs_jwt: ZeUploadBuildStats;
  zeStart: number;
}

export async function zeEnableSnapshotOnEdge(props: ZeEnableSnapshotOnEdgeProps): Promise<void> {
  const { pluginOptions, envs_jwt, zeStart } = props;

  ze_log('Enabling snapshot on edge...');
  const logEvent = logger(pluginOptions);

  const latest = await uploadEnvs({
    body: envs_jwt,
    application_uid: pluginOptions.application_uid,
  });

  if (!latest) {
    logEvent({
      level: 'error',
      action: 'deploy:edge:failed',
      message: 'failed deploying local build to edge',
    });
    return;
  }

  const urls = envs_jwt.urls
    .reverse()
    .map((url, i) => `${brightBlueBgName}  -> ${i === 0 ? cyanBright(url) : blackBright(url)}`)
    .join('\n');

  logEvent(
    {
      level: 'info',
      action: 'build:deploy:done',
      message: `Deployment took ${yellow(`${Date.now() - zeStart}`)}ms`,
    },
    {
      level: 'trace',
      action: 'deploy:url',
      message: `Deploying to edge:\n${urls}\n`,
    }
  );

  ze_log('Build successfully deployed to edge...');
}
