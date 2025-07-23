import { ze_log, type ZephyrEngine, type ZeResolvedDependency } from 'zephyr-agent';
import { type XPackConfiguration } from '../xpack.types';
import { extractFederatedConfig } from './extract-federation-config';
import { isModuleFederationPlugin } from './is-module-federation-plugin';

export function runtimePluginInsert<Compiler>(
  zephyr_engine: ZephyrEngine,
  config: XPackConfiguration<Compiler>,
  resolvedDependencyPairs: ZeResolvedDependency[]
): boolean {
  try {
    const runtimePluginPath = require.resolve('./runtime-plugin');
    ze_log.remotes(`Adding Zephyr runtime plugin: ${runtimePluginPath}`);

    // Create resolved remotes map for runtime plugin with all dependencies
    const resolvedRemotesMap = Object.fromEntries(
      resolvedDependencyPairs.map((dep) => [
        dep.name,
        {
          application_uid: dep.application_uid,
          remote_entry_url: dep.remote_entry_url,
          default_url: dep.default_url,
          name: dep.name,
          library_type: dep.library_type,
        },
      ])
    );

    ze_log.remotes(`Resolved remotes map:`, JSON.stringify(resolvedRemotesMap, null, 2));

    // Pass all resolved dependencies via resourceQuery to single runtime plugin
    const queryData = {
      builder: zephyr_engine.builder,
      resolvedRemotes: resolvedRemotesMap,
    };

    const runtimePluginWithQuery = runtimePluginPath + `?ze=${JSON.stringify(queryData)}`;

    // Find first Module Federation plugin and add runtime plugin
    let runtimePluginAdded = false;

    if (!config.plugins) {
      return false;
    }

    for (const plugin of config.plugins) {
      if (!isModuleFederationPlugin(plugin)) {
        continue;
      }

      const remotesConfig = extractFederatedConfig(plugin);
      if (!remotesConfig) {
        continue;
      }

      // Initialize runtimePlugins array if it doesn't exist
      if (!remotesConfig.runtimePlugins) {
        remotesConfig.runtimePlugins = [];
      }

      // Add the single runtime plugin with all data
      remotesConfig.runtimePlugins.push(runtimePluginWithQuery);
      ze_log.remotes(
        `Runtime plugin added to Module Federation config with ${Object.keys(resolvedRemotesMap).length} remotes`
      );
      runtimePluginAdded = true;
      break; // Add only to first MF plugin found
    }

    if (!runtimePluginAdded) {
      ze_log.remotes(`Warning: No Module Federation plugin found to add runtime plugin`);
      return false;
    }

    return true;
  } catch (error) {
    ze_log.remotes(`Failed to resolve runtime plugin path: ${error}`);
    return false;
  }
}
