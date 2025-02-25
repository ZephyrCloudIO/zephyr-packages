import { ZePluginOptions, ZeInternalPluginOptions } from 'zephyr-xpack-internal';
import { ZephyrEngine } from 'zephyr-agent';

/**
 * Options for the Rollup Zephyr Plugin Extends the base ZePluginOptions with
 * Rollup-specific options
 */
export interface ZephyrRollupPluginOptions extends ZePluginOptions {
  /**
   * Placeholder for rollup-specific options Set to never to ensure this interface is not
   * considered empty by the linter
   */
  _rollup_specific_options?: never;
}

/**
 * Internal options used by the Rollup Zephyr Plugin Extends the base
 * ZeInternalPluginOptions with Rollup-specific internal options
 */
export interface ZephyrRollupInternalPluginOptions extends ZeInternalPluginOptions {
  /** Zephyr Engine instance or Promise<ZephyrEngine> */
  zephyr_engine: ZephyrEngine | Promise<ZephyrEngine>;
}
