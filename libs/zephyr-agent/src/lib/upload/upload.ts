import * as isCI from 'is-ci';
import {
  UploadProviderType,
  type ZeApplicationConfig,
  type ZeBuildAsset,
  type ZeBuildAssetsMap,
  type ZephyrBuildStats,
  type ZephyrPluginOptions,
  cyanBright,
  yellow,
  appDeployResultCache,
} from 'zephyr-edge-contract';
import type { GetDashDataOptions } from '../payload-builders';
import { logger } from '../remote-logs/ze-log-event';
import { cloudflareStrategy, fastlyStrategy, netlifyStrategy } from './strategies';

export async function upload(options: UploadOptions): Promise<void> {
  const logEvent = logger(options.pluginOptions);

  let versionUrl: string;

  switch (options.appConfig.PLATFORM) {
    case UploadProviderType.CLOUDFLARE:
      versionUrl = await cloudflareStrategy(options);
      break;
    case UploadProviderType.NETLIFY:
      versionUrl = await netlifyStrategy(options);
      break;
    case UploadProviderType.FASTLY:
      versionUrl = await fastlyStrategy(options);
      break;
    default:
      throw new Error('Unsupported upload provider.');
  }

  logEvent({
    level: 'trace',
    action: 'deploy:url',
    message: `Deployed to ${cyanBright('Zephyr')}'s edge in ${yellow(`${Date.now() - options.zeStart}`)}ms.\n\n${cyanBright(versionUrl)}`,
  });

  if (isCI) {
    appDeployResultCache.setAppDeployResult(options.appConfig.application_uid, { urls: [versionUrl] });
  }
}

export interface UploadOptions {
  appConfig: ZeApplicationConfig;
  assets: AssetsOptions;
  pluginOptions: ZephyrPluginOptions;
  getDashData: (options: GetDashDataOptions) => ZephyrBuildStats;
  zeStart: number;
}

export interface AssetsOptions {
  assetsMap: ZeBuildAssetsMap;
  missingAssets: ZeBuildAsset[];
  outputPath: string;
  count: number;
}
