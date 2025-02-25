import { ZePluginOptions } from 'zephyr-xpack-internal';
import { Configuration, Compiler } from 'webpack';

/**
 * Webpack-specific plugin options that extend the base ZePluginOptions
 *
 * @remarks
 *   Currently this interface doesn't add any webpack-specific options, but it exists to
 *   provide type safety and to allow adding options in the future without breaking
 *   changes.
 */
export interface ZephyrWebpackPluginOptions extends ZePluginOptions {
  /**
   * Placeholder for webpack-specific options Set to never to ensure this interface is not
   * considered empty by the linter
   */
  _webpack_specific_options?: never;
}

/** Webpack compiler type */
export type WebpackCompiler = Compiler;

/** Webpack configuration type */
export type WebpackConfiguration = Configuration;
