import { Compiler } from 'webpack';
import { brightRedBgName, ze_error, ze_log, ZephyrPluginOptions } from 'zephyr-edge-contract';
import {
  checkAuth,
  get_hash_list,
  getApplicationConfiguration,
  getBuildId,
} from 'zephyr-agent';

export function setupZephyrConfig(
  pluginOptions: ZephyrPluginOptions,
  compiler: Compiler
): void {
  ze_log('Setting Get Zephyr Config hook');
  const { pluginName, zeConfig, application_uid } = pluginOptions;

  compiler.hooks.beforeCompile.tapAsync(pluginName, async (params, cb) => {
    await checkAuth();

    const build_id = await getBuildId(application_uid);
    // console.log('\n\n-------------------build_id-------\n\n', build_id)

    const [appConfig, buildId] = await Promise.all([
      getApplicationConfiguration({ application_uid }),
      getBuildId(application_uid),
      get_hash_list(application_uid)
    ]);

    const { username, email, EDGE_URL } = appConfig;
    ze_log('Got application configuration', { username, email, EDGE_URL });
    ze_log(`Got build id: ${buildId}`);

    if (!buildId) {
      ze_error("DE20022", 'Could not get build id.');
      return cb(new Error(`${brightRedBgName} Error [DE20022]: Could not get build id. See documentation https://docs.zephyr-cloud.io/guide/error/du20022`));
    }

    zeConfig.user = username;
    zeConfig.edge_url = EDGE_URL;
    zeConfig.buildId = buildId;

    return cb();
  });
}
