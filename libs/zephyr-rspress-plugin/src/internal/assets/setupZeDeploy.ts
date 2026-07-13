import { ze_log } from 'zephyr-agent';
import { xpack_zephyr_agent } from 'zephyr-xpack-internal';
import type { ZephyrRspressPluginOptions } from '../../types';
import { buildStats } from '../stats/buildStats';
import { buildAssetMapFromFiles } from './buildAssets';

export async function setupZeDeploy({
  deferEngine,
  outDir,
  files,
  hooks,
  mfConfig,
}: ZephyrRspressPluginOptions): Promise<void> {
  if (!files.length) {
    ze_log.package('ZeRspressPlugin: No files to process.');
    return;
  }

  const [assets, stats] = await Promise.all([
    buildAssetMapFromFiles(outDir, files),
    Promise.resolve(buildStats(outDir, files)),
  ]);
  const zephyr_engine = await deferEngine;
  // The first call reuses generation zero; repeated Rspress builds allocate fresh state.
  try {
    await zephyr_engine.start_new_build();
  } catch (error: unknown) {
    if (zephyr_engine.hasActiveBuild !== false) {
      zephyr_engine.build_failed();
    }
    throw error;
  }

  await xpack_zephyr_agent({
    stats,
    stats_json: stats.toJson(),
    assets,
    pluginOptions: {
      pluginName: 'rspress-ssg',
      zephyr_engine,
      options: {},
      hooks,
      ...(mfConfig === undefined ? {} : { mfConfig }),
    },
  });
}
