import { ZeApplicationConfig, ZeBuildAsset, ZeBuildAssetsMap, ZephyrPluginOptions } from 'zephyr-edge-contract';
import { edgeStrategy } from './strategies/edge.strategy';
import { GetDashDataOptions } from '../payload-builders';

export function upload(options: UploadOptions) {
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

