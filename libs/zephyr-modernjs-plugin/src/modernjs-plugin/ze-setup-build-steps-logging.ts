import { Compiler } from '@rspack/core';
import { ZephyrModernjsInternalPluginOptions } from './ze-modernjs-plugin';
import { ze_log, ZephyrError } from 'zephyr-agent';

export function logBuildSteps(
  pluginOptions: ZephyrModernjsInternalPluginOptions,
  compiler: Compiler
): { buildStartedAt: number } {
  const { pluginName } = pluginOptions;

  let buildStartedAt = Date.now();

  compiler.hooks.beforeCompile.tapAsync(pluginName, async (params, cb) => {
    buildStartedAt = Date.now();
    ze_log('build started at', buildStartedAt);
    cb();
  });

  compiler.hooks.failed.tap(pluginName, (err) => {
    ze_log(`build failed in ${Date.now() - buildStartedAt}ms`);

    pluginOptions.zephyr_engine.logger.then((logger) => {
      logger({
        level: 'error',
        action: 'build:failed',
        message: ZephyrError.format(err),
      });
    });
  });

  return { buildStartedAt };
}
