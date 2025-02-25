import {
  ZePluginOptions,
  ZeInternalPluginOptions,
  ModuleFederationPlugin,
} from 'zephyr-xpack-internal';
import { ZephyrEngine } from 'zephyr-agent';
import { DelegateConfig } from '../type/zephyr-internal-types';

/**
 * Options for the Repack Zephyr Plugin Extends the base ZePluginOptions with
 * Repack-specific options
 */
export interface ZephyrRepackPluginOptions extends ZePluginOptions {
  /** Build target platform */
  target?: DelegateConfig['target'];
}

/**
 * Internal options used by the Repack Zephyr Plugin Extends the base
 * ZeInternalPluginOptions with Repack-specific internal options
 */
export interface ZephyrRepackInternalPluginOptions extends ZeInternalPluginOptions {
  /** Zephyr Engine instance with specific typing */
  zephyr_engine: ZephyrEngine;

  /** Build target platform */
  target?: DelegateConfig['target'];

  /** Module Federation configuration */
  mfConfig?: ModuleFederationPlugin[] | ModuleFederationPlugin;
}
