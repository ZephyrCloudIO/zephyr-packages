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
      }
    | undefined;
}

export {};
