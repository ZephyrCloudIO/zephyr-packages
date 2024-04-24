import { Configuration } from 'webpack';
import {
  createFullAppName,
  ze_log,
  ZephyrPluginOptions,
} from 'zephyr-edge-contract';

import { getGitInfo, getPackageJson } from 'zephyr-agent';
import { isModuleFederationPlugin } from './utils/is-mf-plugin';
import { ZeWebpackPlugin } from './ze-webpack-plugin';
import { resolve_remote_dependencies } from './dependency-resolution/resolve-remote-dependencies';

function getCopyOfMFOptions(config: Configuration): unknown | Array<unknown> {
  return config.plugins
    ?.filter(isModuleFederationPlugin)
    .map((mf: unknown) => {
      const _mf = mf as { _options: unknown };
      if (!_mf?._options) return;

      return JSON.parse(JSON.stringify(_mf._options));
    })
    .filter(Boolean);
}

export function withZephyr(_zephyrOptions?: ZephyrPluginOptions) {
  return async function configure(
    config: Configuration
  ): Promise<Configuration> {
    /* webpack */
    const path_to_execution_dir = config.context;

    /* webpack */
    ze_log('Configuring with Zephyr');

    const packageJson = getPackageJson(path_to_execution_dir);
    ze_log('Loaded Package JSON', packageJson);
    if (!packageJson) return config;

    const gitInfo = getGitInfo();
    ze_log('Loaded Git Info', gitInfo);

    if (!gitInfo?.app.org || !gitInfo?.app.project || !packageJson?.name)
      return config;

    ze_log('Resolving remote dependencies');
    await resolve_remote_dependencies(config, {
      org: gitInfo.app.org,
      project: gitInfo.app.project,
    });
    ze_log('Remote dependencies resolved');

    ze_log('doing zephyr copy of mf options');
    const mfConfigs = getCopyOfMFOptions(config);

    ze_log('Adding Zephyr Webpack Plugin');
    config.plugins?.push(
      new ZeWebpackPlugin({
        application_uid: createFullAppName({
          org: gitInfo.app.org,
          project: gitInfo.app.project,
          name: packageJson?.name,
        }),
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

// todo: make sample wich use direct mf config via ze options
function todo_implement_direct_zephyr_usage(): void {
  // if mfs -> add MF plugins
  // if mfs -> add FederationDashboardPlugin
  // const zephyrOptions = Array.isArray(_zephyrOptions)
  //   ? _zephyrOptions
  //   : [_zephyrOptions];
  /*    zephyrOptions.forEach((zephyrOption) => {
        if (!zephyrOption) return;

        config.plugins?.push(
          new ModuleFederationPlugin({
            name: application_uid,
            filename: 'remoteEntry.js',
            shared: packageJson?.dependencies,
            exposes: zephyrOption?.exposes,
            // todo: rework this part
            // remotes: zephyrOption.remotes?.map((application) =>
            //   replace_remote_with_delegate(
            //     application,
            //     Object.assign({}, delegate_config, { application })
            //   )
            // )
          }),
        );
      });*/
}
