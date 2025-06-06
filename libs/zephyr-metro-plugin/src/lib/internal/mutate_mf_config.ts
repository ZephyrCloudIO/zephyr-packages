import { ze_log, ZephyrEngine, ZeResolvedDependency } from 'zephyr-agent';
import { ZephyrPluginOptions } from 'zephyr-edge-contract';
import {
  createMfRuntimeCode,
  xpack_delegate_module_template,
} from 'zephyr-xpack-internal';

export function mutateMfConfig(
  zephyr_engine: ZephyrEngine,
  config: Pick<ZephyrPluginOptions, 'mfConfig'>['mfConfig'],
  resolvedDependencyPairs: ZeResolvedDependency[] | null,
  delegate_module_template: () => unknown | undefined = xpack_delegate_module_template
) {
  if (!resolvedDependencyPairs?.length) {
    ze_log(`No resolved dependency pairs found, skipping...`);
    return;
  }

  const remotes = config?.remotes;
  if (!remotes) {
    ze_log(
      `No remotes found for plugin: ${JSON.stringify(config, null, 2)}`,
      'skipping...'
    );
    return;
  }

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
    const [v_app] = remote_version.includes('@')
      ? remote_version.split('@')
      : [remote_name];

    ze_log(`v_app: ${v_app}`);
    if (v_app) {
      resolved_dep.remote_entry_url = [v_app, resolved_dep.remote_entry_url].join('@');
      ze_log(`Adding version to remote entry url: ${resolved_dep.remote_entry_url}`);
    }

    resolved_dep.name = remote_name;

    if (remotes[remote_name]) {
      remotes[remote_name] = createMfRuntimeCode(
        zephyr_engine,
        resolved_dep,
        delegate_module_template
      );
      ze_log(`Setting runtime code for remote: ${remotes}`);
    }
  });

  return config;
}
