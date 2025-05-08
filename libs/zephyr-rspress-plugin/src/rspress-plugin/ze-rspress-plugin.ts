import path from 'node:path';
import { ZephyrEngine } from 'zephyr-agent';
import { xpack_zephyr_agent } from 'zephyr-xpack-internal';
import { ZephyrRspressPluginOptions } from '../types';
import { buildAssetMapFromFiles, buildStats } from './utils';

export async function ZeRspressPlugin({
  root,
  files,
}: ZephyrRspressPluginOptions): Promise<void> {
  if (!files.length) {
    console.warn('ZeRspressPlugin: No files to process.');
    return;
  }

  const context = path.resolve(root);
  const engine = await ZephyrEngine.create({ builder: 'rspress', context });

  await engine.start_new_build();

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
      zephyr_engine: engine,
      options: {},
    },
  });
}
