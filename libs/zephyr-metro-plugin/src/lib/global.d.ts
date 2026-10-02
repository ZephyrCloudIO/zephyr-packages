/** Global type declarations for Zephyr Metro Plugin. */

declare global {
  /** Module Federation manifest path populated by Metro bundling commands. */
  var __METRO_FEDERATION_MANIFEST_PATH: string | undefined;

  /**
   * Module Federation global config set by Metro bundler. Used by zephyrCommandWrapper to
   * access the MF configuration.
   */
  var __METRO_FEDERATION_CONFIG:
    | {
        name: string;
        filename?: string;
        remotes?: Record<string, string>;
        exposes?: Record<string, string>;
        shared?: Record<string, unknown>;
        runtimePlugins?: Array<string | [string, Record<string, unknown>]>;
      }
    | undefined;

  /**
   * Application UID set by `withZephyr` once Metro's Babel transformer rewrites
   * `ZE_PUBLIC_*` reads. Read by zephyrCommandWrapper to warn when it is missing.
   */
  var __ZEPHYR_METRO_ENV_REWRITE__: string | undefined;
}

export {};
