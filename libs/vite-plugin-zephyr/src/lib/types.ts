import { ZePluginOptions, ZeInternalPluginOptions } from 'zephyr-xpack-internal';
import { ZephyrEngine } from 'zephyr-agent';
import { ModuleFederationOptions } from './vite-plugin-zephyr';
import { ZephyrInternalOptions } from './internal/types/zephyr-internal-options';

/**
 * Options for the Vite Zephyr Plugin Extends the base ZePluginOptions with Vite-specific
 * options
 */
export interface ZephyrVitePluginOptions extends ZePluginOptions {
  /** Module Federation configuration for Vite */
  mfConfig?: ModuleFederationOptions;
}

/**
 * Internal options used by the Vite Zephyr Plugin Extends the base
 * ZeInternalPluginOptions with Vite-specific internal options
 */
export interface ZephyrViteInternalPluginOptions extends ZeInternalPluginOptions {
  /** Zephyr Engine instance with specific typing */
  zephyr_engine: ZephyrEngine;

  /** Vite-specific internal options */
  viteOptions?: ZephyrInternalOptions;

  /** Root directory of the Vite project */
  root?: string;
}
