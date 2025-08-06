import { ze_log, type ZephyrEngine, type ZeResolvedDependency } from 'zephyr-agent';
import { type XFederatedRemotesConfig } from '../xpack.types';

export function runtimePluginInsert(
  remotesConfig: XFederatedRemotesConfig,
  zephyr_engine: ZephyrEngine,
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

    // __resourceQuery data push
    const runtimePluginWithQuery = runtimePluginPath + `?ze=${JSON.stringify(queryData)}`;

    applyRuntimePlugin(remotesConfig, runtimePluginWithQuery);

    return true; // Successfully inserted runtime plugin
  } catch (error) {
    ze_log.remotes(`Failed to resolve runtime plugin path: ${error}`);
    return false; // Failed to insert runtime plugin
  }
}

function applyRuntimePlugin(
  remotesConfig: XFederatedRemotesConfig,
  runtimePlugin: string
) {
  let configRef: Partial<XFederatedRemotesConfig> = remotesConfig;

  // handle NxModuleFederationPlugin wrapper
  if ('configOverride' in remotesConfig) {
    remotesConfig.configOverride ??= {};
    configRef = remotesConfig.configOverride;
  }
  // Initialize runtimePlugins array if it doesn't exist
  if (!configRef.runtimePlugins) {
    configRef.runtimePlugins = [];
  }

  // Add the single runtime plugin with all data
  configRef.runtimePlugins.push(runtimePlugin);
  ze_log.remotes(`Runtime plugin added to Module Federation config`);
}
