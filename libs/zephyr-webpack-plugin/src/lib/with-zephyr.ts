import { Configuration } from 'webpack';
import { getGitInfo, getPackageJson } from 'zephyr-agent';
import { createApplicationUID, ze_log, ZephyrPluginOptions } from 'zephyr-edge-contract';
import { replaceRemotesWithDelegates } from './dependency-resolution/replace-remotes-with-delegates';
import { getCopyOfMFOptions } from './utils/get-copy-of-mf-options';
import { ZeWebpackPlugin } from './ze-webpack-plugin';

export function withZephyr(_zephyrOptions?: ZephyrPluginOptions) {
  return async function configure(config: Configuration): Promise<Configuration> {
    const path_to_execution_dir = config.context;
    ze_log('Configuring with Zephyr');

    const [packageJson, gitInfo] = await Promise.all([getPackageJson(path_to_execution_dir), getGitInfo()]);

    await replaceRemotesWithDelegates(config, {
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
