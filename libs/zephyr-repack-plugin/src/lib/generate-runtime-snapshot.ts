import { ZephyrRepackPluginOptions } from './ze-repack-plugin';
import { DeployCompiler } from 'zephyr-xpack-internal';

export function generateRuntimeSnapshot<
  T extends ZephyrRepackPluginOptions,
  XCompiler extends DeployCompiler,
>(pluginOptions: T, compiler: XCompiler) {
  const { pluginName, zephyr_engine, runtimeConfig } = pluginOptions;

  console.log('hit generateRuntimeSnapshot');

  compiler.hooks.thisCompilation.tap(pluginName, async (compilation) => {
    console.log('hit generateRuntimeSnapshot thisCompilation');
    compilation.hooks.processAssets.tapPromise(
      {
        name: pluginName,
        stage: compiler.rspack
          ? compiler.rspack.Compilation.PROCESS_ASSETS_STAGE_REPORT
          : compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_REPORT,
      },
      async () => {
        console.log('hit generateRuntimeSnapshot callback');
        await zephyr_engine.runtime_manager?.emitZephyrRuntimeSnapshot(
          { ...runtimeConfig },
          compiler,
          compilation
        );
      }
    );
  });
}
