import * as process from 'node:process';

import { modernjs_zephyr_agent } from './ze-modernjs-upload-agent';
import { ZephyrModernjsInternalPluginOptions } from './ze-modernjs-plugin';
import { Compiler } from '@rspack/core';
import { onDeploymentDone } from 'zephyr-xpack-internal';

export function setupZeDeploy(
  pluginOptions: ZephyrModernjsInternalPluginOptions,
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

        process.nextTick(modernjs_zephyr_agent, {
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
