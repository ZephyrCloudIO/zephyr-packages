import { ZeApplicationConfig, ZeBuildAsset, ZeBuildAssetsMap, ZephyrPluginOptions } from 'zephyr-edge-contract';
import { edgeStrategy } from './strategies/edge.strategy';
import { netlifyPageStrategy } from './strategies/netlify-pages.strategy';
import { GetDashDataOptions } from '../payload-builders';

export function upload(options: UploadOptions) {
  if (options.appConfig.PLATFORM === 'netlify' && options.appConfig.INTEGRATION_CONFIG?.type === 'pages') {
    return netlifyPageStrategy(options);
  }
  return edgeStrategy(options);
}

export interface UploadOptions {
  appConfig: ZeApplicationConfig;
  assetsMap: ZeBuildAssetsMap;
  missingAssets: ZeBuildAsset[];
  pluginOptions: ZephyrPluginOptions;
  getDashData: (options: GetDashDataOptions) => unknown;
  zeStart: number;
  count: number;
}

