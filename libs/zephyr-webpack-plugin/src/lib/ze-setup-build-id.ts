import { Compiler } from 'webpack';
import { ze_error, ze_log, ZeWebpackPluginOptions } from 'zephyr-edge-contract';
import {
  checkAuth,
  getApplicationConfiguration,
  getBuildId,
  logger,
} from 'zephyr-agent';

export function setupZephyrConfig(
  pluginOptions: ZeWebpackPluginOptions,
  compiler: Compiler
): void {
  ze_log('Setting Get Zephyr Config hook');
  const logEvent = logger(pluginOptions);
  const { pluginName, zeConfig, application_uid } = pluginOptions;

  compiler.hooks.beforeCompile.tapAsync(pluginName, async (params, cb) => {
    ze_log('Going to check auth token or get it');
    await checkAuth();

    ze_log('Got auth token, going to get application configuration');
    const { username, email, EDGE_URL } = await getApplicationConfiguration({
      application_uid,
    });
    ze_log('Got application configuration', { username, email, EDGE_URL });
    zeConfig.user = username;
    zeConfig.edge_url = EDGE_URL;
    zeConfig.buildId = void 0;

    ze_log('Going to get build id');
    const buildId = await getBuildId(application_uid).catch((err) => {
      logEvent({
        level: 'error',
        action: 'build:get-build-id:error',
        message: `error receiving build number for '${email}'\n
        ${err.message}\n`,
      });
    });

    if (!buildId) {
      ze_error('Could not get build id');
      return cb(new Error('Could not get build id'));
    }

    zeConfig.buildId = buildId;
    logEvent({
      level: 'info',
      action: 'build:get-build-id:done',
      message: `received build number '${buildId}' for '${zeConfig.user}'`,
    });

    return cb();
  });
}
