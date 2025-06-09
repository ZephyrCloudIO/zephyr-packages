import type { ZephyrPluginOptions, ZeUploadBuildStats } from 'zephyr-edge-contract';
import { uploadEnvs } from '../http/upload-envs';
import { ze_log } from '../logging';
import { brightBlueBgName } from '../logging/debug';
import { blackBright, cyanBright, yellow } from '../logging/picocolor';
import { logger } from '../logging/ze-log-event';

interface ZeEnableSnapshotOnEdgeProps {
  pluginOptions: ZephyrPluginOptions;
  envs_jwt: ZeUploadBuildStats;
  zeStart: number;
}

export async function zeEnableSnapshotOnEdge(
  props: ZeEnableSnapshotOnEdgeProps
): Promise<void> {
  const { pluginOptions, envs_jwt, zeStart } = props;

  ze_log.snapshot('Enabling snapshot on edge...');
  const logEvent = logger(pluginOptions);

  await uploadEnvs({
    body: envs_jwt,
    application_uid: pluginOptions.application_uid,
    logEvent,
  });

  const urls = envs_jwt.urls
    .reverse()
    .map(
      (url, i) =>
        `${brightBlueBgName}  -> ${i === 0 ? cyanBright(url) : blackBright(url)}`
    )
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

  ze_log.snapshot('Build successfully deployed to edge...');
}
