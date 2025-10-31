export { withZephyr } from './webpack-plugin/with-zephyr';
export type { ZephyrWebpackPluginOptions } from './types';
export type { ZephyrBuildHooks, DeploymentInfo } from 'zephyr-agent';

// hacks
export { onDeploymentDone } from 'zephyr-xpack-internal';
export { resolveIndexHtml } from 'zephyr-agent';
