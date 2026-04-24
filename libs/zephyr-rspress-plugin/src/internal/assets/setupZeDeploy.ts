import { ze_log } from 'zephyr-agent';
import { xpack_zephyr_agent } from 'zephyr-xpack-internal';
import type { ZephyrRspressPluginOptions } from '../../types/index.js';
import { buildStats } from '../stats/buildStats.js';
import { buildAssetMapFromFiles } from './buildAssets.js';

export async function setupZeDeploy({
  deferEngine,
  outDir,
  files,
  hooks,
}: ZephyrRspressPluginOptions): Promise<void> {
  if (!files.length) {
    ze_log.package('ZeRspressPlugin: No files to process.');
    return;
  }

  const [assets, stats] = await Promise.all([
    buildAssetMapFromFiles(outDir, files),
    Promise.resolve(buildStats(outDir, files)),
  ]);

  process.nextTick(xpack_zephyr_agent, {
    stats,
    stats_json: stats.toJson(),
    assets,
    pluginOptions: {
      pluginName: 'rspress-ssg',
      zephyr_engine: await deferEngine,
      options: {},
      hooks,
    },
  });
}
