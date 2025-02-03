import { type ZeResolvedDependency } from 'zephyr-agent';
import { createMfRuntimeCode, xpack_delegate_module_template } from './index';
import { ze_log } from 'zephyr-agent';
import { XPackConfiguration } from '../xpack.types';
import { ZephyrEngine } from 'zephyr-agent';
import { iterateFederatedRemoteConfig } from './iterate-federated-remote-config';

export function mutWebpackFederatedRemotesConfig<Compiler>(
  zephyr_engine: ZephyrEngine,
  config: XPackConfiguration<Compiler>,
  resolvedDependencyPairs: ZeResolvedDependency[] | null,
  delegate_module_template: () => unknown = xpack_delegate_module_template
): void {
  if (!resolvedDependencyPairs?.length) {
    ze_log(`No resolved dependency pairs found, skipping...`);
    return;
  }

  iterateFederatedRemoteConfig(config, (remotesConfig) => {
    const remotes = remotesConfig?.remotes;
    if (!remotes) {
      ze_log(
        `No remotes found for plugin: ${JSON.stringify(remotesConfig, null, 2)}`,
        'skipping...'
      );
      return;
    }

    const library_type = remotesConfig.library?.type ?? 'var';

    ze_log(`Library type: ${library_type}`);

    Object.entries(remotes).map((remote) => {
      const [remote_name, remote_version] = remote;
      const resolved_dep = resolvedDependencyPairs.find(
        (dep) => dep.name === remote_name && dep.version === remote_version
      );

      ze_log(`remote_name: ${remote_name}, remote_version: ${remote_version}`);

      if (!resolved_dep) {
        ze_log(
          `Resolved dependency pair not found for remote: ${JSON.stringify(remote, null, 2)}`,
          'skipping...'
        );
        return;
      }

      // todo: this is a version with named export logic, we should take this into account later
      const [v_app] = remote_version.includes('@') ? remote_version.split('@') : [];

      ze_log(`v_app: ${v_app}`);
      if (v_app) {
        resolved_dep.remote_entry_url = [v_app, resolved_dep.remote_entry_url].join('@');
        ze_log(`Adding version to remote entry url: ${resolved_dep.remote_entry_url}`);
      }

      resolved_dep.library_type = library_type;
      resolved_dep.name = remote_name;
      // @ts-expect-error - TS7053: Element implicitly has an any type because expression of type string can't be used to index type RemotesObject | (string | RemotesObject)[]
      // No index signature with a parameter of type string was found on type RemotesObject | (string | RemotesObject)[]
      if (remotes[remote_name]) {
        // @ts-expect-error - read above
        remotes[remote_name] = createMfRuntimeCode(
          resolved_dep,
          delegate_module_template
        );
        ze_log(`Setting runtime code for remote: ${remotes}`);
      }
    });
  });
}
