import { xpack_zephyr_agent } from 'zephyr-xpack-internal';
import type { ZephyrRspressPluginOptions } from './types';
import { buildAssetMapFromFiles } from './internal/assets/buildAssets';
import { buildStats } from './internal/stats/buildStats';

export async function withZephyrRspressSSG({
  deferEngine,
  root,
  files,
}: ZephyrRspressPluginOptions): Promise<void> {
  if (!files.length) {
    console.warn('ZeRspressPlugin: No files to process.');
    return;
  }

  const [assets, stats] = await Promise.all([
    buildAssetMapFromFiles(root, files),
    Promise.resolve(buildStats(root, files)),
  ]);

  process.nextTick(xpack_zephyr_agent, {
    stats,
    stats_json: stats.toJson(),
    assets,
    pluginOptions: {
      pluginName: 'rspress-ssg',
      zephyr_engine: await deferEngine,
      options: {},
    },
  });
}
