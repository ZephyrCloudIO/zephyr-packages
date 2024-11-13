import * as process from 'node:process';
import { Compiler } from 'webpack';

import { ZephyrPluginOptions } from 'zephyr-edge-contract';

import { webpack_zephyr_agent, ZephyrAgentProps } from './ze-agent';
import { onDeploymentDone } from './ze-agent/lifecycle-events';

export function setupZeDeploy(
  pluginOptions: ZephyrPluginOptions,
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

        pluginOptions.outputPath = compiler.outputPath;

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
