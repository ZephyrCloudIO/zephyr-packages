import * as process from 'node:process';
import { Compiler } from 'webpack';

import { webpack_zephyr_agent } from './ze-webpack-upload-agent';
import { onDeploymentDone } from '../lifecycle-events/lifecycle-events';
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

        process.nextTick(webpack_zephyr_agent, {
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
