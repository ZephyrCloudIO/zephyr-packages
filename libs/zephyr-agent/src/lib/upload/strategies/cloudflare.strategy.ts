import * as process from 'process';
import { access, constants, mkdir, writeFile } from 'fs/promises';
import { dirname, sep } from 'path';

import {
  CloudflareOptions,
  UploadProviderConfig,
  ze_error,
  ze_log,
  ZeApplicationConfig,
  ZeBuildAsset,
  ZeBuildAssetsMap,
  ZephyrPluginOptions,
  ZeUploadBuildStats,
} from 'zephyr-edge-contract';

import { update_hash_list } from '../../dvcs/distributed-hash-control';
import { createSnapshot, GetDashDataOptions } from '../../payload-builders';
import {
  zeEnableSnapshotOnEdge,
  zeEnableSnapshotOnPages,
  zeUploadAssets,
  zeUploadBuildStats,
  zeUploadSnapshot,
} from '../../actions';
import { UploadOptions } from '../upload';

export async function cloudflareStrategy({
  pluginOptions,
  getDashData,
  appConfig,
  zeStart,
  assets: { assetsMap, missingAssets, count, outputPath },
  uploadConfig,
}: UploadOptions): Promise<ZeUploadBuildStats | undefined> {
  const snapshot = createSnapshot({
    options: pluginOptions,
    assets: assetsMap,
    username: pluginOptions.username,
    email: appConfig.email,
  });

  await Promise.all([
    zeUploadSnapshot(pluginOptions, snapshot),
    uploadAssets({ assetsMap, missingAssets, pluginOptions, count }),
  ]);

  const envs = await uploadBuildStatsAndEnableEnvs({
    appConfig,
    pluginOptions,
    getDashData,
  });

  if (!envs) {
    ze_error('ZE10016', 'Did not receive envs from build stats upload.');

    return;
  }

  await zeEnableSnapshotOnEdge({
    pluginOptions,
    envs_jwt: envs.value,
    zeStart,
  });

  await uploadToPages({
    uploadConfig,
    pluginOptions,
    outputPath,
    assetsMap,
    envs: envs.value,
  });

  return envs.value;
}

interface UploadAssetsOptions {
  assetsMap: ZeBuildAssetsMap;
  missingAssets: ZeBuildAsset[];
  pluginOptions: ZephyrPluginOptions;
  count: number;
}

async function uploadAssets({
  assetsMap,
  missingAssets,
  pluginOptions,
  count,
}: UploadAssetsOptions) {
  const upload_success = await zeUploadAssets(pluginOptions, {
    missingAssets,
    assetsMap,
    count,
  });
  if (upload_success && missingAssets.length) {
    await update_hash_list(pluginOptions.application_uid, assetsMap);
  }

  return upload_success;
}

interface UploadBuildStatsAndEnableEnvsOptions {
  pluginOptions: ZephyrPluginOptions;
  appConfig: ZeApplicationConfig;
  getDashData: (options: GetDashDataOptions) => unknown;
}

async function uploadBuildStatsAndEnableEnvs({
  appConfig,
  pluginOptions,
  getDashData,
}: UploadBuildStatsAndEnableEnvsOptions) {
  const dashData = getDashData({ appConfig, pluginOptions });

  return zeUploadBuildStats(dashData);
}

interface UploadToPagesOptions {
  uploadConfig: UploadProviderConfig;
  outputPath: string;
  assetsMap: ZeBuildAssetsMap;
  pluginOptions: ZephyrPluginOptions;
  envs: ZeUploadBuildStats;
}

async function uploadToPages({
  uploadConfig,
  pluginOptions,
  outputPath,
  assetsMap,
  envs,
}: UploadToPagesOptions) {
  if (!uploadConfig.providerConfig.projectName) {
    return;
  }

  return saveAssetsToFilesIfNotExist(outputPath, assetsMap)
    .then((outputPath) => upload(outputPath, uploadConfig.providerConfig))
    .then((pages_url) => enablePages(pluginOptions, envs, pages_url))
    .then(() => ze_log('Build deployed to cloudflare pages'))
    .catch((error) =>
      ze_error(`Error upload to cloudflare pages: ${error.message}`)
    );
}

async function upload(
  outputPath: string,
  { api_token, accountId, projectName }: CloudflareOptions
): Promise<string> {
  process.env['CLOUDFLARE_API_TOKEN'] = api_token;

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const wrangler = require('wrangler');

  if (!wrangler) {
    ze_error(
      'Wrangler dependency is needed for Cloudflare deployment. Please install dependencies without --no-optional flag.'
    );
    throw new Error('Wrangler dependency not installed.');
  }

  const result = await wrangler.unstable_pages.deploy({
    directory: outputPath,
    accountId,
    projectName: projectName as string,
  });

  process.env['CLOUDFLARE_API_TOKEN'] = undefined;

  return result.url;
}

async function enablePages(
  pluginOptions: ZephyrPluginOptions,
  buildStats: ZeUploadBuildStats,
  pages_url: string
) {
  return zeEnableSnapshotOnPages({
    pluginOptions,
    envs_jwt: buildStats,
    pages_url,
  });
}

async function saveAssetsToFilesIfNotExist(
  dir: string,
  assetsMap: ZeBuildAssetsMap
): Promise<string> {
  try {
    await access(dir, constants.R_OK | constants.W_OK);
  } catch (error) {
    ze_log(`Dist folder doesn't exist, creating`);
    try {
      await mkdir(dir, { recursive: true });
    } catch (error) {
      ze_error(`Error creating dist folder: ${(error as Error).message}`);
      throw new Error('Unable to create dist folder.');
    }
  }

  const promises: Promise<void>[] = [];
  for (const [, { path, buffer }] of Object.entries(assetsMap)) {
    const fullPath = `${dir}${sep}${path}`;
    if (path.includes('/')) {
      promises.push(
        mkdir(dirname(fullPath), { recursive: true }).then(() =>
          writeFile(`${dir}/${path}`, buffer, { flag: 'w+' })
        )
      );
    } else {
      promises.push(writeFile(`${dir}/${path}`, buffer, { flag: 'w+' }));
    }
  }

  return Promise.all(promises).then(() => dir);
}
