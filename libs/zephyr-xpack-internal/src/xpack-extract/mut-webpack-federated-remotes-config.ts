import type { ZephyrEngine } from 'zephyr-agent';
import { ze_log, type ZeResolvedDependency } from 'zephyr-agent';
import type { XPackConfiguration } from '../xpack.types';
import { parseRemotesAsEntries } from './extract-federated-dependency-pairs';
import { extractFederatedConfig } from './extract-federation-config';
import { createMfRuntimeCode, xpack_delegate_module_template } from './index';
import { isModuleFederationPlugin } from './is-module-federation-plugin';
import { iterateFederatedRemoteConfig } from './iterate-federated-remote-config';

export function mutWebpackFederatedRemotesConfig<Compiler>(
  zephyr_engine: ZephyrEngine,
  config: XPackConfiguration<Compiler>,
  resolvedDependencyPairs: ZeResolvedDependency[] | null,
  delegate_module_template: () => unknown | undefined = xpack_delegate_module_template,
  runtimePlugin?: boolean
): void {
  if (!resolvedDependencyPairs?.length) {
    ze_log.remotes(`No resolved dependency pairs found, skipping...`);
    return;
  }

  ze_log.remotes(`Processing ${resolvedDependencyPairs.length} resolved dependencies`);

  // Add single runtime plugin with all resolved dependencies if enabled
  if (runtimePlugin) {
    try {
      const runtimePluginPath = require.resolve('./runtimePlugin');
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

      ze_log.remotes(
        `Resolved remotes map:`,
        JSON.stringify(resolvedRemotesMap, null, 2)
      );

      // Pass all resolved dependencies via resourceQuery to single runtime plugin
      const queryData = {
        builder: zephyr_engine.builder,
        resolvedRemotes: resolvedRemotesMap,
      };

      const runtimePluginWithQuery =
        runtimePluginPath + `?ze=${JSON.stringify(queryData)}`;

      ze_log.remotes(
        `Runtime plugin query length: ${runtimePluginWithQuery.length} chars`
      );

      // Find first Module Federation plugin and add runtime plugin
      let runtimePluginAdded = false;
      if (config.plugins) {
        for (const plugin of config.plugins) {
          if (isModuleFederationPlugin(plugin)) {
            const remotesConfig = extractFederatedConfig(plugin);
            if (remotesConfig) {
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
          }
        }
      }

      if (!runtimePluginAdded) {
        ze_log.remotes(
          `Warning: No Module Federation plugin found to add runtime plugin`
        );
      }
    } catch (error) {
      ze_log.remotes(`Failed to resolve runtime plugin path: ${error}`);
    }
  } else {
    ze_log.remotes(`Runtime plugin is not enabled`);
  }

  iterateFederatedRemoteConfig(config, (remotesConfig) => {
    const remotes = remotesConfig?.remotes;
    if (!remotes) {
      ze_log.remotes(
        `No remotes found for plugin: ${JSON.stringify(remotesConfig, null, 2)}`,
        'skipping...'
      );
      return;
    }

    const library_type = remotesConfig.library?.type ?? 'var';

    ze_log.remotes(`Library type: ${library_type}`);

    const remoteEntries = parseRemotesAsEntries(remotes);

    remoteEntries.forEach((remote) => {
      const [remote_name, remote_version] = remote;
      const resolved_dep = resolvedDependencyPairs.find((dep) => {
        const nameMatch = dep.name === remote_name;
        const versionMatch =
          dep.version === 'latest' ? true : dep.version === remote_version;
        return nameMatch && versionMatch;
      });

      ze_log.remotes(`remote_name: ${remote_name}, remote_version: ${remote_version}`);

      if (!resolved_dep) {
        ze_log.remotes(
          `Resolved dependency pair not found for remote: ${JSON.stringify(
            remote,
            null,
            2
          )}`,
          'skipping...'
        );
        return;
      }

      // If runtime plugin is enabled, don't modify remotes here - let runtime plugin handle it
      if (runtimePlugin) {
        return;
      }

      // Legacy behavior when runtime plugin is not enabled
      // todo: this is a version with named export logic, we should take this into account later
      const [v_app] = remote_version.includes('@')
        ? remote_version.split('@')
        : [remote_name];

      ze_log.remotes(`v_app: ${v_app}`);
      if (v_app) {
        resolved_dep.remote_entry_url = [v_app, resolved_dep.remote_entry_url].join('@');
        ze_log.remotes(
          `Adding version to remote entry url: ${resolved_dep.remote_entry_url}`
        );
      }

      resolved_dep.library_type = library_type;
      resolved_dep.name = remote_name;
      const runtimeCode = createMfRuntimeCode(
        zephyr_engine,
        resolved_dep,
        delegate_module_template
      );

      if (Array.isArray(remotes)) {
        const remoteIndex = remotes.indexOf(remote_name);
        if (remoteIndex === -1) return;
        // @ts-expect-error - Nx's ModuleFederationPlugin has different remote types
        remotes.splice(remoteIndex, 1, [remote_name, runtimeCode]);
        return;
      }

      remotes[remote_name] = runtimeCode;
    });
    ze_log.remotes(`Set runtime code for remotes: ${remotes}`);
  });
}
