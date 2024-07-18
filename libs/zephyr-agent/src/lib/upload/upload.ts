import {
  UploadProviderConfig,
  UploadProviderType,
  ZeApplicationConfig,
  ZeBuildAsset,
  ZeBuildAssetsMap,
  ZephyrPluginOptions,
} from 'zephyr-edge-contract';
import { cloudflareStrategy, netlifyStrategy } from './strategies';
import { GetDashDataOptions } from '../payload-builders';

export function upload(options: UploadOptions) {
  switch (options.uploadConfig.type) {
    case UploadProviderType.CLOUDFLARE:
      return cloudflareStrategy(options);
    case UploadProviderType.NETLIFY:
      return netlifyStrategy(options);
  }

  throw new Error('Unsupported upload provider.');
}

export interface UploadOptions {
  appConfig: ZeApplicationConfig;
  assets: AssetsOptions;
  pluginOptions: ZephyrPluginOptions;
  getDashData: (options: GetDashDataOptions) => unknown;
  zeStart: number;
  uploadConfig: UploadProviderConfig;
}

export interface AssetsOptions {
  assetsMap: ZeBuildAssetsMap;
  missingAssets: ZeBuildAsset[];
  outputPath: string;
  count: number;
}
