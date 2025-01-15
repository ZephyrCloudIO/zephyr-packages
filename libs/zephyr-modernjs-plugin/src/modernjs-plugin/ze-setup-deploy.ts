import * as process from 'node:process';

import { rspack_zephyr_agent } from './ze-rspack-upload-agent';
import { ZephyrRspackInternalPluginOptions } from './ze-rspack-plugin';
import { Compiler } from '@rspack/core';
import { onDeploymentDone } from 'zephyr-xpack-internal';

export function setupZeDeploy(
  pluginOptions: ZephyrRspackInternalPluginOptions,
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
        console.log('HELLO ASSETS', JSON.stringify(Object.keys(assets), null, 2));

        await pluginOptions.zephyr_engine.start_new_build();

        process.nextTick(rspack_zephyr_agent, {
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
