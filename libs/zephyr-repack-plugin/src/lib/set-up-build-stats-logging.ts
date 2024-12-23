import { Compiler } from '@rspack/core';
import { ZephyrRepackPluginOptions } from './ze-repack-plugin';
import { ze_log, ZephyrError } from 'zephyr-agent';

export function log_build_steps(
  pluginOptions: ZephyrRepackPluginOptions,
  compiler: Compiler
): {
  buildStartedAt: number;
} {
  const { pluginName, zephyr_engine } = pluginOptions;

  let buildStartedAt = Date.now();

  compiler.hooks.beforeCompile.tapAsync(pluginName, async (params, cb) => {
    buildStartedAt = Date.now();
    ze_log('build started at', buildStartedAt);
    cb();
  });

  compiler.hooks.failed.tap(pluginName, (err) => {
    ze_log(`build failed in ${Date.now() - buildStartedAt}ms`);
    zephyr_engine.logger.then((logEvent) =>
      logEvent({
        level: 'error',
        action: 'build:failed',
        message: ZephyrError.format(err),
      })
    );
  });

  return { buildStartedAt };
}
