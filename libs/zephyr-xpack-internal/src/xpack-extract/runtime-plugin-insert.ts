import { ze_log } from 'zephyr-agent';
import type { ModuleFederationPlugin, XFederatedRemotesConfig } from '../xpack.types';
import { extractFederatedConfig } from './extract-federation-config';

export function runtimePluginInsert(plugin: ModuleFederationPlugin): boolean {
  try {
    const runtimePluginPath = require.resolve('./runtime-plugin');
    ze_log.remotes(`Adding Zephyr runtime plugin: ${runtimePluginPath}`);

    let configRef: Partial<XFederatedRemotesConfig> | undefined =
      extractFederatedConfig(plugin);

    if (!configRef) {
      ze_log.remotes('No MF config found.');
      return false;
    }

    // handle NxModuleFederationPlugin wrapper
    if ('configOverride' in plugin) {
      plugin.configOverride ??= {};
      configRef = plugin.configOverride;
    }

    // Initialize runtimePlugins array if it doesn't exist
    if (!configRef.runtimePlugins) {
      configRef.runtimePlugins = [];
    }

    // Add the single runtime plugin with all data
    configRef.runtimePlugins.push(runtimePluginPath);
    ze_log.remotes(`Runtime plugin added to Module Federation config`);

    return true; // Successfully inserted runtime plugin
  } catch (error) {
    ze_log.remotes(`Failed to resolve runtime plugin path: ${error}`);
    return false; // Failed to insert runtime plugin
  }
}
