import { type ZeResolvedDependency } from 'zephyr-agent';
import {
  createMfRuntimeCode,
  iterateFederationConfig,
  xpack_delegate_module_template,
} from './index';
import { ze_log } from 'zephyr-agent';
import { XPackConfiguration } from '../xpack.types';
import { ZephyrEngine } from 'zephyr-agent';

export function mutWebpackFederatedRemotesConfig<Compiler>(
  zephyr_engine: ZephyrEngine,
  config: XPackConfiguration<Compiler>,
  resolvedDependencyPairs: ZeResolvedDependency[] | null,
  delegate_module_template: () => unknown
): void {
  ze_log(
    `Resolved dependency pairs: ${JSON.stringify(resolvedDependencyPairs, null, 2)}`,
    'mutWebpackFederatedRemotesConfig'
  );
  let library_type = '';
  if (!resolvedDependencyPairs?.length) {
    ze_log(`No resolved dependency pairs found, skipping...`);
    return;
  }
  iterateFederationConfig(zephyr_engine, config, (plugin) => {
    const remotes = plugin?.remotes;
    if (!remotes) {
      ze_log(
        `No remotes found for plugin: ${JSON.stringify(plugin, null, 2)}`,
        'skipping...'
      );
      return;
    }

    ze_log(`zephyr_engine.build_type: ${zephyr_engine.build_type}`);
    ze_log(`Library type: ${plugin.library?.type}`);

    library_type =
      (plugin.library?.type ?? zephyr_engine.build_type === 'repack') ? 'var' : 'self';

    Object.entries(remotes).map((remote) => {
      ze_log(`remote: ${JSON.stringify(remote, null, 2)}`);
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

      ze_log(`Setting library type: ${library_type}`);
      resolved_dep.library_type = library_type;
      resolved_dep.name = remote_name;
      // @ts-expect-error - TS7053: Element implicitly has an any type because expression of type string can't be used to index type RemotesObject | (string | RemotesObject)[]
      // No index signature with a parameter of type string was found on type RemotesObject | (string | RemotesObject)[]
      if (remotes[remote_name]) {
        // @ts-expect-error - read above
        remotes[remote_name] = createMfRuntimeCode(
          resolved_dep,
          xpack_delegate_module_template
        );
        ze_log(`Setting runtime code for remote: ${remotes}`);
      }
    });
  });
}
