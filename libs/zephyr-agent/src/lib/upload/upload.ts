import {
  UploadProviderType,
  type ZeApplicationConfig,
  type ZeBuildAsset,
  type ZeBuildAssetsMap,
  type ZephyrBuildStats,
  type ZephyrPluginOptions,
  cyanBright,
  yellow,
} from 'zephyr-edge-contract';
import type { GetDashDataOptions } from '../payload-builders';
import { logger } from '../remote-logs/ze-log-event';
import { cloudflareStrategy, netlifyStrategy } from './strategies';

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
    default:
      throw new Error('Unsupported upload provider.');
  }

  logEvent({
    level: 'trace',
    action: 'deploy:url',
    message: `Deployed to ${cyanBright('Zephyr')}'s edge in ${yellow(`${Date.now() - options.zeStart}`)}ms.\n\n${cyanBright(versionUrl)}`,
  });

  // FIXME: Now only possible if:
  // https://zephyr-cloud.slack.com/archives/C05NRK2SUSE/p1725400546897959
  // if (deployResult) {
  //   await appDeployResultCache.setAppDeployResult(result.app_version.application_uid, { urls: result.urls });
  // }

  // empty line to separate logs from other plugins
  console.log();
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
