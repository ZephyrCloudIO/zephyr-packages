export { withZephyr } from './rspack-plugin/with-zephyr';
export type { ZephyrRspackPluginOptions } from './types';
export type { ZephyrBuildHooks, DeploymentInfo } from 'zephyr-agent';

// hacks
export { onDeploymentDone } from 'zephyr-xpack-internal';
export { resolveIndexHtml } from 'zephyr-agent';
