import { type ZeResolvedDependency } from 'zephyr-agent';
import { createMfRuntimeCode, iterateFederationConfig } from './index';
import { XPackConfiguration } from '../xpack.types';

export function mutWebpackFederatedRemotesConfig<Compiler>(
  config: XPackConfiguration<Compiler>,
  resolvedDependencyPairs: ZeResolvedDependency[] | null
): void {
  if (!resolvedDependencyPairs?.length) {
    return;
  }
  iterateFederationConfig(config, (plugin) => {
    if (!plugin._options.remotes) return;

    const library_type = plugin._options?.library?.type ?? 'var';

    Object.entries(plugin._options.remotes).map((remote) => {
      const [remote_name, remote_version] = remote;
      const resolved_dep = resolvedDependencyPairs.find(
        (dep) => dep.name === remote_name && dep.version === remote_version
      );

      if (!resolved_dep) {
        return;
      }

      // const [v_app] = plugin['_options'].remotes[remote_name]?.split('@') ?? [];
      const [v_app] = remote_version.split('@') ?? [];

      if (v_app) {
        resolved_dep.remote_entry_url = [v_app, resolved_dep.remote_entry_url].join('@');
      }

      resolved_dep.library_type = library_type;
      resolved_dep.name = remote_name;
      // @ts-expect-error - TS7053: Element implicitly has an any type because expression of type string can't be used to index type RemotesObject | (string | RemotesObject)[]
      // No index signature with a parameter of type string was found on type RemotesObject | (string | RemotesObject)[]
      if (plugin._options.remotes[remote_name]) {
        // @ts-expect-error - read above
        plugin._options.remotes[remote_name] = createMfRuntimeCode(resolved_dep);
      }
    });
  });
}
