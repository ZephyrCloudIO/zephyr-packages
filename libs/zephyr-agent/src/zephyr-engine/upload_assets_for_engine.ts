import * as isCI from 'is-ci';
import type {
  ZeBuildAssetsMap,
  ZephyrBuildStats,
  ZephyrPluginOptions,
} from 'zephyr-edge-contract';
import { getUploadStrategy } from '../lib/deployment/get-upload-strategy';
import type { ZeApplicationConfig } from '../lib/node-persist/upload-provider-options';
import { get_missing_assets } from '../lib/edge-hash-list/get-missing-assets';
import { ze_log } from '../lib/logging';
import { setAppDeployResult } from '../lib/node-persist/app-deploy-result-cache';
import { createSnapshot } from '../lib/transformers/ze-build-snapshot';
import { build_finished_for_engine } from './build_finished_for_engine';
import type { ZeGitInfo } from '../lib/build-context/ze-util-get-git-info';
import type { ZeApplicationProperties } from './mut_zephyr_app_uid';

export interface UploadAssetsContext {
  application_uid: string;
  build_id: Promise<string> | null;
  resolved_hash_list: { hash_set: Set<string> } | null;
  application_configuration: Promise<ZeApplicationConfig>;
  version_url: string | null;
  logger: Promise<unknown>;
  build_start_time: number | null;
  federated_dependencies: unknown[] | null;
  env: { target: unknown };
  gitProperties: ZeGitInfo;
  applicationProperties: ZeApplicationProperties;
}

export interface UploadAssetsProps {
  assetsMap: ZeBuildAssetsMap;
  buildStats: ZephyrBuildStats;
  mfConfig?: Pick<ZephyrPluginOptions, 'mfConfig'>['mfConfig'];
}

export async function upload_assets_for_engine(
  props: UploadAssetsProps,
  context: UploadAssetsContext
): Promise<string | null> {
  ze_log('Initializing: upload assets');
  const { assetsMap, buildStats, mfConfig } = props;

  if (!context.application_uid || !context.build_id) {
    ze_log('Failed to upload assets: missing application_uid or build_id');
    return null;
  }

  await context.build_id;
  const hash_set = context.resolved_hash_list;

  const missingAssets = get_missing_assets({
    assetsMap,
    hash_set: hash_set ?? { hash_set: new Set() },
  });

  const snapshot = await createSnapshot(context as never, {
    assets: assetsMap,
    mfConfig,
  });

  const upload_options = {
    snapshot,
    getDashData: () => buildStats,
    assets: {
      assetsMap,
      missingAssets,
    },
  };

  const platform = (await context.application_configuration).PLATFORM;
  const strategy = getUploadStrategy(platform);
  const version_url = await strategy(context as never, upload_options);

  if (isCI) {
    const application_uid = context.application_uid;
    await setAppDeployResult(application_uid, { urls: [version_url] });
  }

  await build_finished_for_engine({
    logger: context.logger,
    build_start_time: context.build_start_time,
    version_url,
    federated_dependencies: context.federated_dependencies as any,
    env: { target: context.env.target as any },
  });

  return version_url;
}
