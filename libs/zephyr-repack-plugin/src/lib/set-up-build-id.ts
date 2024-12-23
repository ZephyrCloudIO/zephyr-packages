import type { Compiler } from '@rspack/core';

import { ZephyrRepackPluginOptions } from './ze-repack-plugin';
import { logFn, white, yellow, ze_log, ZeErrors, ZephyrError } from 'zephyr-agent';
import { cyanBright } from 'zephyr-agent';

export function setupZephyrConfig(
  pluginOptions: ZephyrRepackPluginOptions,
  compiler: Compiler
): void {
  const { pluginName, zephyr_engine } = pluginOptions;
  ze_log('Setting Get Zephyr Config hook');
  compiler.hooks.beforeCompile.tapAsync(pluginName, async (params, cb) => {
    try {
      const { application_uid, build_id } = zephyr_engine;
      const appConfig = await zephyr_engine.application_configuration;

      const { username, email, EDGE_URL } = appConfig;

      ze_log('Got application configuration', { username, email, EDGE_URL });

      ze_log(`Got build id: ${build_id}`);

      const logEvent = await zephyr_engine.logger;

      logEvent({
        level: 'info',
        action: 'build:info:user',
        ignore: true,
        message: `Hi ${cyanBright(username)}!\n${white(application_uid)}${yellow(`#${build_id}`)}\n`,
      });

      return cb();
    } catch (cause) {
      const zeError = new ZephyrError(ZeErrors.ERR_UNKNOWN, {
        message: 'Failed to get Zephyr configuration',
        cause,
      });

      logFn('error', ZephyrError.format(zeError));

      cb();
    }
  });
}
