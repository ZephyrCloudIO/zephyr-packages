export type ZephyrModuleFederationRuntimePlugin =
  | string
  | [string, Record<string, unknown>];

/**
 * Backward-compatible single-container options used by established Zephyr adapters. New
 * multi-container publication uses `ZephyrModuleFederationConfig[]` instead.
 */
export interface ZephyrLegacyModuleFederationConfig {
  name: string;
  filename: string;
  exposes?: Record<string, string>;
  remotes?: Record<string, string>;
  shared?: Record<string, unknown>;
  runtimePlugins?: ZephyrModuleFederationRuntimePlugin[];
  manifest?: boolean | { fileName?: string; filePath?: string };
}

/** JSON-serializable Module Federation options retained with a Zephyr snapshot. */
export interface ZephyrModuleFederationConfig {
  name?: string;
  filename?: string;
  library?:
    | string
    | string[]
    | {
        type?: string;
        [key: string]: unknown;
      };
  exposes?: Record<string, unknown> | Array<string | Record<string, unknown>>;
  remotes?: Record<string, unknown> | Array<string | Record<string, unknown>>;
  shared?: Record<string, unknown> | Array<string | Record<string, unknown>>;
  runtimePlugins?: ZephyrModuleFederationRuntimePlugin[];
  manifest?: boolean | { fileName?: string; filePath?: string };
  [key: string]: unknown;
}

/**
 * Load metadata for one independently addressable Module Federation container.
 *
 * A build can publish more than one container, so consumers must use the enclosing
 * `ZephyrBuildStats.federation` array rather than assuming one top-level remote.
 */
export interface ZephyrModuleFederationBuildMetadata {
  name?: string;
  remote?: string;
  mf_manifest?: string;
  library_type?: string;
  exposes?: ZephyrModuleFederationConfig['exposes'];
  shared?: ZephyrModuleFederationConfig['shared'];
}
