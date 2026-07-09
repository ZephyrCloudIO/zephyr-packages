export { withZephyr } from './rspack-plugin/with-zephyr';
export { ZeRspackPlugin } from './rspack-plugin/ze-rspack-plugin';
export type { ZephyrRspackPluginOptions } from './types';
export type { ZephyrRspackInternalPluginOptions } from './rspack-plugin/ze-rspack-plugin';
export type { ZephyrBuildHooks, DeploymentInfo } from 'zephyr-agent';

// hacks
export { onDeploymentDone } from 'zephyr-xpack-internal';
export { resolveIndexHtml } from 'zephyr-agent';
