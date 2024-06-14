import { Configuration } from 'webpack';

import { createApplicationUID, ze_log, ZephyrPluginOptions } from 'zephyr-edge-contract';
import { getGitInfo, getPackageJson } from 'zephyr-agent';

import { ZeWebpackPlugin } from './ze-webpack-plugin';
import { resolve_remote_dependencies } from './dependency-resolution/resolve-remote-dependencies';
import { getCopyOfMFOptions } from './utils/get-copy-of-mf-options';

export function withZephyr(_zephyrOptions?: ZephyrPluginOptions) {
  return async function configure(
    config: Configuration
  ): Promise<Configuration> {
    /* webpack */
    const path_to_execution_dir = config.context;
    ze_log('Configuring with Zephyr');

    const [packageJson, gitInfo] = await Promise.all([
      getPackageJson(path_to_execution_dir),
      getGitInfo(),
    ]);

    await resolve_remote_dependencies(config, {
      org: gitInfo.app.org,
      project: gitInfo.app.project,
    });

    const mfConfigs = getCopyOfMFOptions(config);
    const application_uid = createApplicationUID({
      org: gitInfo.app.org,
      project: gitInfo.app.project,
      name: packageJson?.name,
    });

    config.plugins?.push(
      new ZeWebpackPlugin({
        application_uid,
        app: {
          name: packageJson.name,
          version: packageJson.version,
          org: gitInfo.app.org,
          project: gitInfo.app.project,
        },
        git: gitInfo?.git,
        mfConfig: Array.isArray(mfConfigs) ? mfConfigs[0] : void 0,
        wait_for_index_html: _zephyrOptions?.wait_for_index_html,
      })
    );

    return config;
  };
}
