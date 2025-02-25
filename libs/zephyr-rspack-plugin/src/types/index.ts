import { ZePluginOptions } from 'zephyr-xpack-internal';
import { Compiler } from '@rspack/core';

/**
 * Rspack-specific plugin options that extend the base ZePluginOptions
 *
 * @remarks
 *   Currently this interface doesn't add any rspack-specific options, but it exists to
 *   provide type safety and to allow adding options in the future without breaking
 *   changes.
 */
export interface ZephyrRspackPluginOptions extends ZePluginOptions {
  /**
   * Placeholder for rspack-specific options Set to never to ensure this interface is not
   * considered empty by the linter
   */
  _rspack_specific_options?: never;
}

/** Rspack compiler type */
export type RspackCompiler = Compiler;
