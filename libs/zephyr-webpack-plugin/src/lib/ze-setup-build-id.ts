import type { Compiler } from 'webpack';
import { CouldNotGetBuildIdError, checkAuth, getApplicationConfiguration, getBuildId, get_hash_list, logger } from 'zephyr-agent';
import { type ZephyrPluginOptions, cyanBright, white, yellow, ze_error, ze_log } from 'zephyr-edge-contract';

export function setupZephyrConfig(pluginOptions: ZephyrPluginOptions, compiler: Compiler): void {
  ze_log('Setting Get Zephyr Config hook');
  const { pluginName, zeConfig, application_uid } = pluginOptions;

  compiler.hooks.beforeCompile.tapAsync(pluginName, async (params, cb) => {
    await checkAuth();

    const [appConfig, buildId] = await Promise.all([
      getApplicationConfiguration({ application_uid }),
      getBuildId(application_uid),
      get_hash_list(application_uid),
    ]);

    const { username, email, EDGE_URL } = appConfig;
    ze_log('Got application configuration', { username, email, EDGE_URL });

    if (!buildId) {
      ze_error('ERR_GET_BUILD_ID', 'Could not get build id.');
      return cb(new CouldNotGetBuildIdError());
    }

    ze_log(`Got build id: ${buildId}`);

    const logEvent = logger(pluginOptions);

    logEvent({
      level: 'info',
      action: 'build:info:user',
      ignore: true,
      message: `Hi ${cyanBright(username)}!\n${white(application_uid)}${yellow(`#${buildId}`)}\n`,
    });

    zeConfig.user = username;
    zeConfig.edge_url = EDGE_URL;
    zeConfig.buildId = buildId;

    return cb();
  });
}
