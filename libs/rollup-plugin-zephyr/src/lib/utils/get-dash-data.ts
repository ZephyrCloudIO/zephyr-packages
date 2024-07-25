import { ZeApplicationConfig, ZephyrPluginOptions } from 'zephyr-edge-contract';
import { zeGetDashData } from 'zephyr-agent';

interface GetDashDataOptions {
  appConfig: ZeApplicationConfig;
  pluginOptions: ZephyrPluginOptions;
}

export function getDashData({ pluginOptions, appConfig }: GetDashDataOptions) {
  return zeGetDashData({ pluginOptions, appConfig });
}
