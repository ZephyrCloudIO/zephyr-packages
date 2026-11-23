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
  const logEvent = logger({
    application_uid: pluginOptions.application_uid,
    buildId: pluginOptions.zeConfig?.buildId,
    git: pluginOptions.git,
  });

  await uploadEnvs({
    body: envs_jwt,
    application_uid: pluginOptions.application_uid,
    logEvent,
  });

  const deployedUrls = envs_jwt.urls.reverse();
  const urls = deployedUrls
    .map(
      (url, i) =>
        `${brightBlueBgName}  -> ${i === 0 ? cyanBright(url) : blackBright(url)}`
    )
    .join('\n');

  const durationMs = Date.now() - zeStart;
  logEvent(
    {
      level: 'info',
      action: 'build:deploy:done',
      data: { outcome: 'deployed', duration_ms: durationMs },
      message: `Deployment took ${yellow(`${durationMs}`)}ms`,
    },
    {
      level: 'trace',
      action: 'deploy:url',
      data: { urls: deployedUrls },
      message: `Deploying to edge:\n${urls}\n`,
    }
  );

  ze_log.snapshot('Build successfully deployed to edge...');
}
