/** Options for the Zephyr environment variables plugin. */
export interface ZeEnvVarsPluginOptions {
  /**
   * Which environment variable syntaxes to process
   *
   * @default ['processEnv', 'importMetaEnv']
   */
  patterns?: ('processEnv' | 'importMetaEnv')[];

  /**
   * Position to inject the script tag in HTML
   *
   * @default 'head-prepend'
   */
  injectPosition?: 'head-prepend' | 'head-append' | 'body-prepend';

  /**
   * Public path for the asset URL
   *
   * @default '' (Uses the public path from the bundler config)
   */
  publicPath?: string;
}
