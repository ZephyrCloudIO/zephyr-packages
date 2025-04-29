import { type ZeResolvedDependency } from 'zephyr-agent';
import { createMfRuntimeCode, xpack_delegate_module_template } from './index';
import { ze_log } from 'zephyr-agent';
import { XPackConfiguration } from '../xpack.types';
import { ZephyrEngine } from 'zephyr-agent';
import { iterateFederatedRemoteConfig } from './iterate-federated-remote-config';
import { parse_remote_app_name } from 'zephyr-edge-contract';

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

    if (Array.isArray(remotes)) {
      ze_log.remotes(`Remote array definition is currently not supported, skipping...`);
      return;
    }

    Object.entries(remotes).map((remote) => {
      const remote_alias_name = remote[0];
      let remote_version = remote[1];

      if (typeof remote_version !== 'string') {
        ze_log.remotes('Remote location is not a string, replacing remote name.');
        remote_version = remote_alias_name;
      }

      const v_app = parse_remote_app_name(remote_version) ?? remote_alias_name;

      const resolved_dep = resolvedDependencyPairs.find((dep) => {
        const matchName = dep.name === v_app || dep.application_uid === v_app;
        const matchVersion = dep.version === remote_version;
        return matchName && matchVersion;
      });

      ze_log.remotes(
        `remote_name: ${remote_alias_name}`,
        `remote_version: ${remote_version}`
      );

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

      const remote_name = resolved_dep.name;
      const remote_url = resolved_dep.remote_entry_url;
      resolved_dep.remote_entry_url = [remote_name, remote_url].join('@');
      ze_log.remotes(`Adding version to remote entry url: ${remote_url}`);

      resolved_dep.library_type = library_type;
      resolved_dep.name = remote_name;
      ze_log.remotes(`Resolved dependency: ${JSON.stringify(resolved_dep, null, 2)}`);

      delete remotes[remote_alias_name];

      remotes[remote_name] = createMfRuntimeCode(
        zephyr_engine,
        resolved_dep,
        delegate_module_template
      );
      ze_log.remotes(`Setting runtime code for remote: ${remote_name}`);
    });
  });
}
