import { ze_log } from 'zephyr-agent';
import type { ModuleFederationPlugin, XFederatedRemotesConfig } from '../xpack.types';

function mutableFederationConfig(
  plugin: ModuleFederationPlugin
): Partial<XFederatedRemotesConfig> | undefined {
  if ('configOverride' in plugin) {
    plugin.configOverride ??= {};
    return plugin.configOverride;
  }

  const options = plugin._options ?? plugin.options ?? plugin.config;
  if (!options) return undefined;
  return 'config' in options ? options.config : options;
}

export function runtimePluginInsert(plugin: ModuleFederationPlugin): boolean {
  try {
    const runtimePluginPath = require.resolve('./runtime-plugin');
    ze_log.remotes(`Adding Zephyr runtime plugin: ${runtimePluginPath}`);
    return configureZephyrRuntimePlugin(plugin, runtimePluginPath);
  } catch (error) {
    ze_log.remotes(`Failed to resolve runtime plugin path: ${error}`);
    return false; // Failed to insert runtime plugin
  }
}

export function configureZephyrRuntimePlugin(
  plugin: ModuleFederationPlugin,
  runtimePluginPath: string
): boolean {
  const configRef = mutableFederationConfig(plugin);

  if (!configRef) {
    ze_log.remotes('No MF config found.');
    return false;
  }

  configRef.runtimePlugins ??= [];
  if (!configRef.runtimePlugins.includes(runtimePluginPath)) {
    configRef.runtimePlugins.push(runtimePluginPath);
  }
  ze_log.remotes(`Runtime plugin added to Module Federation config`);

  return true;
}
