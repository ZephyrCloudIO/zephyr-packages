import {
  UploadProviderType,
  type ZeApplicationConfig,
  type ZeBuildAsset,
  type ZeBuildAssetsMap,
  type ZephyrBuildStats,
  type ZephyrPluginOptions,
  yellow,
} from 'zephyr-edge-contract';
import type { GetDashDataOptions } from '../payload-builders';
import { logger } from '../remote-logs/ze-log-event';
import { cloudflareStrategy, netlifyStrategy } from './strategies';

export async function upload(options: UploadOptions): Promise<void> {
  const log = logger(options.pluginOptions);

  switch (options.appConfig.PLATFORM) {
    case UploadProviderType.CLOUDFLARE:
      await cloudflareStrategy(options);
      break;
    case UploadProviderType.NETLIFY:
      await netlifyStrategy(options);
      break;
    default:
      throw new Error('Unsupported upload provider.');
  }

  log({
    level: 'info',
    action: 'build:deploy:done',
    message: `Build deployed in ${yellow(`${Date.now() - options.zeStart}`)}ms`,
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
