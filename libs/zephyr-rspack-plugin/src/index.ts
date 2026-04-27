export { withZephyr } from './rspack-plugin/with-zephyr.ts';
export type { ZephyrRspackPluginOptions } from './types/index.js';
export type { ZephyrBuildHooks, DeploymentInfo } from 'zephyr-agent';

// hacks
export { onDeploymentDone } from 'zephyr-xpack-internal';
export { resolveIndexHtml } from 'zephyr-agent';
