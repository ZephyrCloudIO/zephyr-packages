import { UploadProviderConfig, ze_error, ze_log, ZeBuildAssetsMap, ZephyrPluginOptions, ZeUploadBuildStats } from 'zephyr-edge-contract';
import { upload } from './upload';
import { enablePages } from './enable-pages';
import { saveAssetsToFilesIfNotExist } from './upsert-assets-to-files';

interface UploadToPagesOptions {
  uploadConfig: UploadProviderConfig;
  outputPath: string;
  assetsMap: ZeBuildAssetsMap;
  pluginOptions: ZephyrPluginOptions;
  envs: ZeUploadBuildStats;
}

async function uploadToPages({ uploadConfig, pluginOptions, outputPath, assetsMap, envs }: UploadToPagesOptions) {
  if (!uploadConfig.providerConfig.projectName) {
    return;
  }

  return saveAssetsToFilesIfNotExist(outputPath, assetsMap)
    .then((outputPath) => upload(outputPath, uploadConfig.providerConfig))
    .then((pages_url) => enablePages(pluginOptions, envs, pages_url))
    .then(() => ze_log('Build deployed to cloudflare pages'))
    .catch((error) => ze_error('ERR_UPLOAD_TO_CLOUDFLARE_PAGES', `Error upload to cloudflare pages: ${error.message}`));
}
