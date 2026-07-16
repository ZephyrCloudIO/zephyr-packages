import * as path from 'path';

export interface ModuleFederationRemoteConfig {
  name: string;
  entry: string;
  type?: string;
  [key: string]: unknown;
}

export interface ModuleFederationManifestOptions {
  fileName?: string;
  filePath?: string;
}

export interface ModuleFederationLibraryOptions {
  type?: string;
  [key: string]: unknown;
}

export type ModuleFederationRuntimePlugin = string | [string, Record<string, unknown>];

export interface ModuleFederationOptions {
  name?: string;
  filename?: string;
  library?: string | string[] | ModuleFederationLibraryOptions;
  remotes?: Record<string, string | ModuleFederationRemoteConfig>;
  exposes?: Record<string, string>;
  runtimePlugins?: ModuleFederationRuntimePlugin[];
  shared?: Record<string, unknown>;
  manifest?: boolean | ModuleFederationManifestOptions;
  dts?: boolean | Record<string, unknown>;
  [key: string]: unknown;
}

export const ZEPHYR_MF_RUNTIME_PLUGIN_ID = 'virtual:zephyr-mf-runtime-plugin';
export const RESOLVED_ZEPHYR_MF_RUNTIME_PLUGIN_ID = `\0${ZEPHYR_MF_RUNTIME_PLUGIN_ID}`;

export function getRuntimePluginPath() {
  return path.resolve(__dirname, 'runtime_plugin.mjs');
}

export function ensureRuntimePlugin(
  mfConfig: ModuleFederationOptions,
  manifestUrl?: string
): ModuleFederationOptions {
  // @module-federation/vite captures this array by reference during eager option
  // normalization. Mutate it in place so an asynchronously resolved deployment URL can
  // upgrade the entry before runtime code generation.
  const runtimePlugins = (mfConfig.runtimePlugins ??= []);
  const existingIndex = runtimePlugins.findIndex(
    (entry) => (Array.isArray(entry) ? entry[0] : entry) === ZEPHYR_MF_RUNTIME_PLUGIN_ID
  );

  if (existingIndex === -1) {
    // MF serializes runtime plugins into remoteEntry.js, so inject ours before build.
    runtimePlugins.push(
      manifestUrl === undefined
        ? ZEPHYR_MF_RUNTIME_PLUGIN_ID
        : [ZEPHYR_MF_RUNTIME_PLUGIN_ID, { manifestUrl }]
    );
  } else if (manifestUrl !== undefined) {
    const existingEntry = runtimePlugins[existingIndex];
    const existingOptions = Array.isArray(existingEntry) ? existingEntry[1] : {};
    runtimePlugins[existingIndex] = [
      ZEPHYR_MF_RUNTIME_PLUGIN_ID,
      { ...existingOptions, manifestUrl },
    ];
  }

  return mfConfig;
}
