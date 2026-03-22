import * as path from 'path';
import type { ModuleFederationOptions } from '../../types/module-federation-options';

export const ZEPHYR_MF_RUNTIME_PLUGIN_ID = 'virtual:zephyr-mf-runtime-plugin';
export const RESOLVED_ZEPHYR_MF_RUNTIME_PLUGIN_ID = `\0${ZEPHYR_MF_RUNTIME_PLUGIN_ID}`;

export function getRuntimePluginPath() {
  return path.resolve(__dirname, 'runtime_plugin.mjs');
}

export function ensureRuntimePlugin(
  mfConfig: ModuleFederationOptions
): ModuleFederationOptions {
  const runtimePlugins = [...(mfConfig.runtimePlugins ?? [])];

  if (!runtimePlugins.includes(ZEPHYR_MF_RUNTIME_PLUGIN_ID)) {
    runtimePlugins.push(ZEPHYR_MF_RUNTIME_PLUGIN_ID);
  }

  mfConfig.runtimePlugins = runtimePlugins;
  return mfConfig;
}
