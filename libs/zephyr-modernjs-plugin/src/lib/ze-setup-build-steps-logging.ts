import { Compiler } from 'webpack';
import { logger } from 'zephyr-agent';
import { ze_log, ZephyrError, ZephyrPluginOptions } from 'zephyr-edge-contract';

export function logBuildSteps(
  pluginOptions: ZephyrPluginOptions,
  compiler: Compiler
): { buildStartedAt: number } {
  const { pluginName, buildEnv } = pluginOptions;
  const logEvent = logger(pluginOptions);

  let buildStartedAt = Date.now();

  compiler.hooks.beforeCompile.tapAsync(pluginName, async (params, cb) => {
    buildStartedAt = Date.now();
    ze_log('build started at', buildStartedAt);
    cb();
  });

  compiler.hooks.failed.tap(pluginName, (err) => {
    ze_log(`build failed in ${Date.now() - buildStartedAt}ms`);

    logEvent({
      level: 'error',
      action: 'build:failed',
      message: ZephyrError.format(err),
    });
  });

  return { buildStartedAt };
}
