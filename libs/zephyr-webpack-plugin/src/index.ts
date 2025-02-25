/**
 * Zephyr Webpack Plugin
 *
 * A webpack plugin that integrates with Zephyr Cloud for deployment and sharing
 */

// Main API export
export { withZephyr } from './webpack-plugin/with-zephyr';
export { ZeWebpackPlugin } from './webpack-plugin/ze-webpack-plugin';
export type { ZephyrWebpackPluginOptions } from './types';

// Additional utilities that might be useful for webpack users
export { onDeploymentDone } from 'zephyr-xpack-internal';
export { resolveIndexHtml } from 'zephyr-agent';
