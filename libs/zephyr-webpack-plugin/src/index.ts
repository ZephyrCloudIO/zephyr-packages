export { withZephyr } from './webpack-plugin/with-zephyr.js';
export type { ZephyrWebpackPluginOptions } from './types/index.js';
export type { ZephyrBuildHooks, DeploymentInfo } from 'zephyr-agent';

// hacks
export { onDeploymentDone } from 'zephyr-xpack-internal';
export { resolveIndexHtml } from 'zephyr-agent';
