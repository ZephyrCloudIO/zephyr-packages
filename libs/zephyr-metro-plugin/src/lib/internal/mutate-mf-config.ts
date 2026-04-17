import type { ZephyrEngine, ZeResolvedDependency } from 'zephyr-agent';
import { ze_log } from 'zephyr-agent';
import type { ZephyrPluginOptions } from 'zephyr-edge-contract';

export interface MutateMfConfigOptions {
  delegate_module_template?: () => unknown;
  useManifestEntry?: boolean;
}

export function mutateMfConfig(
  zephyr_engine: ZephyrEngine,
  config: Pick<ZephyrPluginOptions, 'mfConfig'>['mfConfig'],
  resolvedDependencyPairs: ZeResolvedDependency[] | null,
  options?: MutateMfConfigOptions
) {
  // Lazy load zephyr-xpack-internal to avoid static import
  const {
    createMfRuntimeCode,
    xpack_delegate_module_template,
  } = require('zephyr-xpack-internal');
  const template = options?.delegate_module_template || xpack_delegate_module_template;
  if (!resolvedDependencyPairs?.length) {
    ze_log.mf(`No resolved dependency pairs found, skipping...`);
    return;
  }

  const remotes = config?.remotes;
  if (!remotes) {
    ze_log.mf(
      `No remotes found for plugin: ${JSON.stringify(config, null, 2)}`,
      'skipping...'
    );
    return;
  }

  Object.entries(remotes).map((remote) => {
    const [remote_name, remote_version] = remote;

    if (
      !remote_name ||
      typeof remote_name !== 'string' ||
      !remote_version ||
      typeof remote_version !== 'string'
    ) {
      ze_log.mf(`Invalid remote configuration: ${JSON.stringify(remote)}, skipping...`);
      return;
    }
    const resolved_dep = resolvedDependencyPairs.find(
      (dep) => dep.name === remote_name && dep.version === remote_version
    );

    ze_log.mf(`remote_name: ${remote_name}, remote_version: ${remote_version}`);

    if (!resolved_dep) {
      ze_log.mf(
        `Resolved dependency pair not found for remote: ${JSON.stringify(remote, null, 2)}`,
        'skipping...'
      );
      return;
    }

    // todo: this is a version with named export logic, we should take this into account later
    const [v_app] = remote_version.includes('@')
      ? remote_version.split('@')
      : [remote_name];

    let baseEntryUrl: string;
    let usingManifest: boolean;
    if (options?.useManifestEntry && resolved_dep.manifest_url) {
      baseEntryUrl = resolved_dep.manifest_url;
      usingManifest = true;
    } else {
      baseEntryUrl = resolved_dep.remote_entry_url;
      usingManifest = false;
      if (options?.useManifestEntry) {
        ze_log.mf(
          `useManifestEntry requested but manifest_url missing for '${remote_name}', falling back to container URL`
        );
      }
    }

    ze_log.mf(`v_app: ${v_app}`);
    if (v_app) {
      resolved_dep.remote_entry_url = [v_app, baseEntryUrl].join('@');
      ze_log.mf(
        `Resolved ${usingManifest ? 'manifest' : 'container'} entry URL for '${remote_name}': ${resolved_dep.remote_entry_url}`
      );
    }

    resolved_dep.name = remote_name;

    if (remotes[remote_name]) {
      remotes[remote_name] = createMfRuntimeCode(zephyr_engine, resolved_dep, template);
      ze_log.mf(`Setting runtime code for remote: ${remotes}`);
    }
  });

  return config;
}
