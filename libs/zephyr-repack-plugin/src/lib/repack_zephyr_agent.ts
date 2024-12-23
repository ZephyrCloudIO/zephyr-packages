import type { XStats, XStatsCompilation } from 'zephyr-xpack-internal';
import {
  type Source,
  type ZephyrBuildStats,
  ZephyrPluginOptions,
} from 'zephyr-edge-contract';

import { buildAssetsMap, logFn, ze_log, ZephyrError, ZeErrors } from 'zephyr-agent';
import { ZephyrRepackPluginOptions } from './ze-repack-plugin';
import { emitDeploymentDone, getBuildStats } from 'zephyr-xpack-internal';

export interface ZephyrAgentProps {
  stats: XStats;
  stats_json: XStatsCompilation;
  pluginOptions: ZephyrRepackPluginOptions;
  assets: Record<string, Source>;
}

export async function repack_zephyr_agent({
  stats,
  stats_json,
  assets,
  pluginOptions,
}: ZephyrAgentProps): Promise<void> {
  const { zephyr_engine } = pluginOptions;
  const { application_uid, build_id } = zephyr_engine;
  const { EDGE_URL, PLATFORM } = await zephyr_engine.application_configuration;
  ze_log('zephyr agent started.');

  if (pluginOptions.upload_file !== true) return;

  if (!build_id) {
    emitDeploymentDone();
    throw new ZephyrError(ZeErrors.ERR_GET_BUILD_ID);
  }

  if (!application_uid) {
    emitDeploymentDone();
    throw new ZephyrError(ZeErrors.ERR_MISSING_APPLICATION_UID);
  }

  const assetsMap = await buildAssetsMap(assets, extractBuffer, getAssetType);

  ze_log('repack_zephyr_agent.pluginOptions: ', pluginOptions);

  try {
    const dashData = await getBuildStats({
      stats,
      stats_json,
      assets,
      pluginOptions,
      EDGE_URL,
      PLATFORM,
    });

    ze_log('Started uploading...');

    await zephyr_engine.upload_assets({
      assetsMap,
      mfConfig: pluginOptions.mfConfig as Pick<
        ZephyrPluginOptions,
        'mfConfig'
      >['mfConfig'],
      buildStats: dashData as ZephyrBuildStats,
    });
  } catch (err) {
    logFn('error', ZephyrError.format(err));
  } finally {
    emitDeploymentDone();
  }
}

function getAssetType(asset: Source): string {
  return asset.constructor.name;
}

function extractBuffer(asset: Source): Buffer | string | undefined {
  const className = getAssetType(asset);
  switch (className) {
    case 'CachedSource':
    case 'CompatSource':
    case 'RawSource':
    case 'ConcatSource':
    case 'SourceMapSource':
      return asset?.buffer && asset.buffer();
    case 'ReplaceSource':
      return asset.source();
    default:
      return void 0;
  }
}
