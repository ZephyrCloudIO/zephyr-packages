import { Compiler } from 'webpack';
import { logger } from 'zephyr-agent';
import { ze_error, ze_log, ZeWebpackPluginOptions } from 'zephyr-edge-contract';

export function logBuildSteps(
  pluginOptions: ZeWebpackPluginOptions,
  compiler: Compiler
): { buildStartedAt: number } {
  const { pluginName, zeConfig, buildEnv } = pluginOptions;
  const logEvent = logger(pluginOptions);

  let buildStartedAt = -1;
  compiler.hooks.beforeCompile.tapAsync(pluginName, async (params, cb) => {
    if (!zeConfig.buildId) return cb();
    buildStartedAt = Date.now();
    ze_log('build started at', buildStartedAt);
    cb();
  });

  compiler.hooks.done.tap(pluginName, () => {
    if (!zeConfig.buildId) return;
    logEvent({
      level: 'info',
      action: 'build:done',
      message: `${buildEnv} build finished in ${Date.now() - buildStartedAt}ms`,
    });
  });

  compiler.hooks.failed.tap(pluginName, (err) => {
    if (!zeConfig.buildId) return;
    ze_error('build failed', err);
    logEvent({
      level: 'error',
      action: 'build:failed',
      message: `${buildEnv} build failed in ${Date.now() - buildStartedAt}ms \n ${err.message} \n ${err.stack}`,
    });
  });

  return { buildStartedAt };
}
