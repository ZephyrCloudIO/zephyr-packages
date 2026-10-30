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
        /** Runtime plugin import paths after MF's option normalization. */
        plugins?: string[];
      }
    | undefined;

  /**
   * Application UID set by `withZephyr` once Metro's Babel transformer rewrites
   * `ZE_PUBLIC_*` reads. Read by zephyrCommandWrapper to warn when it is missing.
   */
  var __ZEPHYR_METRO_ENV_REWRITE__: string | undefined;

  /**
   * `runtimeManifest` selector set by `withZephyr`. Read by the publication command
   * wrapper, which resolves it and binds the result into the env runtime plugin.
   */
  var __ZEPHYR_METRO_RUNTIME_MANIFEST__: string | undefined;
}

export {};
