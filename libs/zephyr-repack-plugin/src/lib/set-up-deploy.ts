import * as process from 'node:process';
import { Compiler } from '@rspack/core';
import { ze_log } from 'zephyr-agent';
import { ZephyrRepackPluginOptions } from './ze-repack-plugin';
import { onDeploymentDone, xpack_zephyr_agent } from 'zephyr-xpack-internal';

export function setup_deploy(
  pluginOptions: ZephyrRepackPluginOptions,
  compiler: Compiler
): void {
  ze_log('set up zephyr deploy...');
  const { pluginName } = pluginOptions;
  compiler.hooks.thisCompilation.tap(pluginName, (compilation) => {
    compilation.hooks.processAssets.tapPromise(
      {
        name: pluginName,
        stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_REPORT,
      },
      async (assets) => {
        const stats = compilation.getStats();
        const stats_json = compilation.getStats().toJson();

        await pluginOptions.zephyr_engine.start_new_build();

        process.nextTick(xpack_zephyr_agent, {
          stats,
          stats_json,
          assets,
          pluginOptions,
        });

        await onDeploymentDone();

        // empty line to separate logs from other plugins
        console.log();
      }
    );
  });
}
