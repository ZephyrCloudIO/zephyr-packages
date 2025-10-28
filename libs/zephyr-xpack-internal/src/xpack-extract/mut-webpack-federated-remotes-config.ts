import type { ZephyrEngine } from 'zephyr-agent';
import { ze_log, type ZeResolvedDependency } from 'zephyr-agent';
import { normalize_app_name } from 'zephyr-edge-contract';
import type { XPackConfiguration } from '../xpack.types';
import { parseRemotesAsEntries } from './extract-federated-dependency-pairs';
import { createMfRuntimeCode, xpack_delegate_module_template } from './index';
import { isLegacyMFPlugin } from './is-legacy-mf-plugin';
import { iterateFederatedRemoteConfig } from './iterate-federated-remote-config';
import { runtimePluginInsert } from './runtime-plugin-insert';

export function mutWebpackFederatedRemotesConfig<Compiler>(
  zephyr_engine: ZephyrEngine,
  config: XPackConfiguration<Compiler>,
  resolvedDependencyPairs: ZeResolvedDependency[] | null,
  delegate_module_template: () => unknown | undefined = xpack_delegate_module_template
): void {
  if (!resolvedDependencyPairs?.length) {
    ze_log.remotes(`No resolved dependency pairs found, skipping...`);
    return;
  }

  ze_log.remotes(`Processing ${resolvedDependencyPairs.length} resolved dependencies`);

  iterateFederatedRemoteConfig(config, (remotesConfig, plugin) => {
    const remotes = remotesConfig?.remotes;
    if (!remotes) {
      ze_log.remotes(
        `No remotes found for plugin: ${JSON.stringify(remotesConfig, null, 2)}`,
        'skipping...'
      );
      return;
    }

    let runtimePluginInserted = false;
    const isRepack = zephyr_engine.builder === 'repack';

    // Try runtime plugin insertion first if not legacy plugin and not Repack
    if (!isLegacyMFPlugin(plugin) && !isRepack) {
      runtimePluginInserted = runtimePluginInsert(plugin);
    }

    // Legacy processing - only if runtime plugin wasn't inserted or isEnhanced is false
    const library_type = remotesConfig.library?.type ?? 'var';

    ze_log.remotes(`Library type: ${library_type}`);

    const remoteEntries = parseRemotesAsEntries(remotes);

    remoteEntries.forEach((remote) => {
      const [remote_name, remote_version] = remote;
      // TODO(ZE): Investigate global impact of relaxed matching rules below.
      // Some ecosystems declare remotes as "name@url" or use wildcard '*'.
      // If this proves too permissive for other bundlers/configs, we should
      // introduce an explicit normalization step earlier (during extraction)
      // and keep matching here strict. Track with an issue and tests.
      const resolved_dep = resolvedDependencyPairs.find((dep) => {
        const nameMatch = dep.name === remote_name;
        // Allow wildcard and Nx-style "name@url" declarations to match
        const versionMatch =
          dep.version === 'latest' ||
          dep.version === '*' ||
          (typeof remote_version === 'string' &&
            remote_version.startsWith(`${remote_name}@`)) ||
          dep.version === remote_version;
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
      const remote_entry_url = resolved_dep.remote_entry_url;

      // todo: this is a version with named export logic, we should take this into account later
      const [v_app] = remote_version.includes('@')
        ? remote_version.split('@')
        : [remote_name];

      ze_log.remotes(`v_app: ${v_app}`);
      if (v_app) {
        resolved_dep.remote_entry_url = [v_app, remote_entry_url].join('@');
        ze_log.remotes(`Adding version to remote entry url: ${remote_entry_url}`);
      }

      resolved_dep.library_type = library_type;
      resolved_dep.name = normalize_app_name(remote_name);

      // Final value can be current one, zephyr delegate
      // or fixed URL when using Zephyr Runtime plugin
      let remote_final_value: string = resolved_dep.remote_entry_url;

      if (!runtimePluginInserted && !isRepack) {
        remote_final_value = createMfRuntimeCode(
          zephyr_engine,
          resolved_dep,
          delegate_module_template
        );
      }

      // Nx remote definition is an Array
      if (Array.isArray(remotes)) {
        // Nx may declare remotes as an array of strings like
        //  - "name"
        //  - "name@http://localhost:4201/remoteEntry.js"
        // Replace the matching entry by name or name@...
        let remoteIndex = -1;
        for (let i = 0; i < remotes.length; i++) {
          const entry = remotes[i] as unknown as string;
          if (typeof entry === 'string') {
            if (entry === remote_name || entry.startsWith(`${remote_name}@`)) {
              remoteIndex = i;
              break;
            }
          }
        }
        if (remoteIndex === -1) return;
        const nx_remote_value = remote_final_value.startsWith('promise')
          ? remote_final_value
          : remote_entry_url; // Only the URL without alias for Nx definition
        // @ts-expect-error - Nx's ModuleFederationPlugin has different remote types
        remotes.splice(remoteIndex, 1, [remote_name, nx_remote_value]);
        return;
      }

      remotes[remote_name] = remote_final_value;
    });
    ze_log.remotes(`Set runtime code for remotes: ${remotes}`);
  });
}
