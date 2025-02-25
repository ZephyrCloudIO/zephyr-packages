import { ZePluginOptions, ZeInternalPluginOptions } from 'zephyr-xpack-internal';
import { ZephyrEngine } from 'zephyr-agent';

/**
 * Options for the Rolldown Zephyr Plugin Extends the base ZePluginOptions with
 * Rolldown-specific options
 */
export interface ZephyrRolldownPluginOptions extends ZePluginOptions {
  /**
   * Placeholder for rolldown-specific options Set to never to ensure this interface is
   * not considered empty by the linter
   */
  _rolldown_specific_options?: never;
}

/**
 * Internal options used by the Rolldown Zephyr Plugin Extends the base
 * ZeInternalPluginOptions with Rolldown-specific internal options
 */
export interface ZephyrRolldownInternalPluginOptions extends ZeInternalPluginOptions {
  /** Zephyr Engine instance or Promise<ZephyrEngine> */
  zephyr_engine: ZephyrEngine | Promise<ZephyrEngine>;
}
