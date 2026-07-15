import { ze_log } from 'zephyr-agent';
import type { ModuleFederationPlugin, XFederatedRemotesConfig } from '../xpack.types';

function pluginFederationConfig(
  plugin: ModuleFederationPlugin
): XFederatedRemotesConfig | undefined {
  const options = plugin._options ?? plugin.options ?? plugin.config;
  if (!options) return undefined;
  return 'config' in options ? options.config : options;
}

function mutableFederationConfig(
  plugin: ModuleFederationPlugin
): Partial<XFederatedRemotesConfig> | undefined {
  // Nx applies configOverride after its base config, so runtime plugins belong there.
  if ('configOverride' in plugin) {
    plugin.configOverride ??= {};
    return plugin.configOverride;
  }

  return pluginFederationConfig(plugin);
}

function runtimePluginPath(
  entry: NonNullable<XFederatedRemotesConfig['runtimePlugins']>[number]
): string {
  return Array.isArray(entry) ? entry[0] : entry;
}

export function runtimePluginInsert(
  plugin: ModuleFederationPlugin,
  manifestUrl?: string
): boolean {
  try {
    const zephyrRuntimePluginPath = require.resolve('./runtime-plugin');
    ze_log.remotes(`Adding Zephyr runtime plugin: ${zephyrRuntimePluginPath}`);

    return configureZephyrRuntimePlugin(plugin, zephyrRuntimePluginPath, manifestUrl);
  } catch (error) {
    ze_log.remotes(`Failed to resolve runtime plugin path: ${error}`);
    return false; // Failed to insert runtime plugin
  }
}

export function configureZephyrRuntimePlugin(
  plugin: ModuleFederationPlugin,
  zephyrRuntimePluginPath: string,
  manifestUrl?: string
): boolean {
  const configRef = mutableFederationConfig(plugin);
  if (!configRef) {
    ze_log.remotes('No MF config found.');
    return false;
  }

  const runtimePlugins = (configRef.runtimePlugins ??= []);
  const existingIndex = runtimePlugins.findIndex(
    (entry) => runtimePluginPath(entry) === zephyrRuntimePluginPath
  );

  if (existingIndex === -1) {
    runtimePlugins.push(
      manifestUrl === undefined
        ? zephyrRuntimePluginPath
        : [zephyrRuntimePluginPath, { manifestUrl }]
    );
  } else if (manifestUrl !== undefined) {
    const existingEntry = runtimePlugins[existingIndex];
    const existingOptions = Array.isArray(existingEntry) ? existingEntry[1] : {};
    runtimePlugins[existingIndex] = [
      zephyrRuntimePluginPath,
      { ...existingOptions, manifestUrl },
    ];
  }
  ze_log.remotes(`Runtime plugin added to Module Federation config`);

  return true;
}
