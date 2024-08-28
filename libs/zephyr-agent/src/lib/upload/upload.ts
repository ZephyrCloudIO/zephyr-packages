import {
  appDeployResultCache,
  UploadProviderType,
  type ZeApplicationConfig,
  type ZeBuildAsset,
  type ZeBuildAssetsMap,
  type ZephyrBuildStats,
  type ZephyrPluginOptions,
  type ZeUploadBuildStats,
} from 'zephyr-edge-contract';
import { cloudflareStrategy, netlifyStrategy } from './strategies';
import type { GetDashDataOptions } from '../payload-builders';

export async function upload(options: UploadOptions) {
  let deployResult: ZeUploadBuildStats | undefined = undefined;

  switch (options.appConfig.PLATFORM) {
    case UploadProviderType.CLOUDFLARE:
      deployResult = await cloudflareStrategy(options);
      break;
    case UploadProviderType.NETLIFY:
      deployResult = await netlifyStrategy(options);
      break;
    default:
      throw new Error('Unsupported upload provider.');
  }

  if (deployResult) {
    const { application_uid, ...rest } = getInfoForBuildStats(deployResult);
    await appDeployResultCache.setAppDeployResult(application_uid, rest);
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

function getInfoForBuildStats(result: ZeUploadBuildStats): {
  application_uid: string;
  urls: string[];
} {
  return {
    application_uid: result.app_version.application_uid,
    urls: result.urls,
  };
}
