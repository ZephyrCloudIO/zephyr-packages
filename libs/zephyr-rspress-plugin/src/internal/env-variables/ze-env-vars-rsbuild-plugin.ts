import { type ZeEnvVarsPluginOptions } from 'zephyr-xpack-internal';
import { RsbuildPlugin } from '@rsbuild/core';
import { ZeEnvVarsRspackPlugin } from '../../ze-env-vars-rspress-plugin';
// import { ZeEnvVarsRspackPlugin } from 'zephyr-rspack-plugin';

export function zeEnvVarsRsbuildPlugin(options?: ZeEnvVarsPluginOptions): RsbuildPlugin {
  return {
    name: 'ze-env-vars-rsbuild-plugin',
    setup(api) {
      api.modifyRspackConfig((config) => {
        config.plugins ??= [];
        config.plugins.push(new ZeEnvVarsRspackPlugin(options));
        return config;
      });
    },
  };
}