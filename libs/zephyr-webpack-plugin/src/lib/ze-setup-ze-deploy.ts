import * as process from 'node:process';
import { Compiler } from 'webpack';
import { ze_error, ze_log, ZeWebpackPluginOptions } from 'zephyr-edge-contract';
import { zephyr_agent, ZephyrAgentProps } from './ze-agent';
import { onDeploymentDone } from './ze-agent/lifecycle-events';

export function setupZeDeploy(
  pluginOptions: ZeWebpackPluginOptions,
  compiler: Compiler
): void {
  const { pluginName, zeConfig } = pluginOptions;
  compiler.hooks.thisCompilation.tap(pluginName, (compilation) => {
    compilation.hooks.processAssets.tapPromise(
      {
        name: pluginName,
        stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_REPORT,
      },
      async (assets) => {
        if (!zeConfig.buildId) {
          // no id - no cloud builds ;)
          ze_error('No build id found. Skipping deployment.');
          return;
        }

        ze_log('Compilation done.');
        const stats = compilation.getStats();
        const stats_json = compilation.getStats().toJson();
        ze_log('Converted stats to json. Starting deployment.');

        process.nextTick((props: ZephyrAgentProps) => zephyr_agent(props), {
          stats,
          stats_json,
          assets,
          pluginOptions,
        });

        if (!pluginOptions.wait_for_index_html) {
          await onDeploymentDone();
        }
      }
    );
  });
}
