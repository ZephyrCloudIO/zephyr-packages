import { getGitInfo, getPackageJson } from 'zephyr-agent';
import { createApplicationUID, ze_log, ZephyrPluginOptions } from 'zephyr-edge-contract';
import { AppTools, CliPlugin } from '@modern-js/app-tools/.';
import moduleFederationPlugin from '@module-federation/modern-js';
import { replace_remote_in_mf_config } from '../delegate-module/zephyr-delegate';
import { ZeWebpackPlugin } from './ze-webpack-plugin';

const pluginName = 'zephyr-modernjs-plugin';

export function withZephyr(_zephyrOptions?: ZephyrPluginOptions): CliPlugin<AppTools> {
  if (!_zephyrOptions?.mfConfig)
    return {
      name: pluginName,
    };

  const mfConfig: ZephyrPluginOptions['mfConfig'] = { ..._zephyrOptions?.mfConfig };

  return {
    name: pluginName,
    post: ['@modern-js/plugin-module-federation-config'],
    setup: async ({ useAppContext }) => {
      if (!mfConfig) return;

      const appConfig = useAppContext();
      const path_to_execution_dir = appConfig.appDirectory;
      const [packageJson, gitInfo] = await Promise.all([
        getPackageJson(path_to_execution_dir),
        getGitInfo(),
      ]);

      await replace_remote_in_mf_config(mfConfig, {
        org: gitInfo.app.org,
        project: gitInfo.app.project,
      });

      const application_uid = createApplicationUID({
        org: gitInfo.app.org,
        project: gitInfo.app.project,
        name: packageJson?.name,
      });

      return {
        config: async () => {
          return {
            tools: {
              rspack(config) {
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
                    mfConfig,
                  })
                );
              },
            },
          };
        },
      };
    },
    usePlugins: [
      moduleFederationPlugin({
        //@ts-expect-error - This is a simple type error around Shared object type signature but still compatible.
        config: mfConfig,
      }),
      zephyrFixPublicPath(),
    ],
  };
}

function zephyrFixPublicPath(): CliPlugin<AppTools> {
  return {
    name: 'zephyr-publicpath-fix',
    pre: [pluginName],
    setup: async () => {
      return {
        config: async () => {
          return {
            tools: {
              rspack(config, { isServer }) {
                config.output = {
                  ...config.output,
                  publicPath: 'auto',
                };
              },
            },
          };
        },
      };
    },
  };
}
