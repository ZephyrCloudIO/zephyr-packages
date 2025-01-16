import * as process from 'node:process';
import { Compiler } from 'webpack';

import { onDeploymentDone, xpack_zephyr_agent } from 'zephyr-xpack-internal';
import { ZephyrWebpackInternalPluginOptions } from './ze-webpack-plugin';

export function setupZeDeploy(
  pluginOptions: ZephyrWebpackInternalPluginOptions,
  compiler: Compiler
): void {
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

        if (!pluginOptions.wait_for_index_html) {
          await onDeploymentDone();
        }

        // empty line to separate logs from other plugins
        console.log();
      }
    );
  });
}
