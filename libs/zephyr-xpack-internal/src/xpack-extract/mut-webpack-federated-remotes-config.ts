import type { ZephyrEngine } from 'zephyr-agent';
import { ze_log, type ZeResolvedDependency } from 'zephyr-agent';
import type { XPackConfiguration } from '../xpack.types';
import { parseRemotesAsEntries } from './extract-federated-dependency-pairs';
import { createMfRuntimeCode, xpack_delegate_module_template } from './index';
import { iterateFederatedRemoteConfig } from './iterate-federated-remote-config';

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
