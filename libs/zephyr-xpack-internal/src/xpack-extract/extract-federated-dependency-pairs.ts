import type { ZeDependencyPair } from 'zephyr-agent';
import { is_zephyr_dependency_pair, readPackageJson } from 'zephyr-agent';

import type { XFederatedRemotesConfig, XPackConfiguration } from '../xpack.types';
import { iterateFederatedRemoteConfig } from './iterate-federated-remote-config';

export function extractFederatedDependencyPairs(
  config: XPackConfiguration<any>
): ZeDependencyPair[] {
  const depsPairs: ZeDependencyPair[] = [];

  const { zephyrDependencies } = readPackageJson(config.context ?? process.cwd());
  if (zephyrDependencies) {
    Object.entries(zephyrDependencies).map(([name, version]) => {
      depsPairs.push({ name, version } as ZeDependencyPair);
    });
  }

  iterateFederatedRemoteConfig(config, (remotesConfig: XFederatedRemotesConfig) => {
    if (!remotesConfig?.remotes) return;
    Object.entries(remotesConfig.remotes).map(([remote_name, remote_version]) => {
      depsPairs.push({
        name: remote_name,
        version: remote_version,
      } as ZeDependencyPair);
    });
  });

  return depsPairs
    .flat()
    .filter((dep): dep is ZeDependencyPair => is_zephyr_dependency_pair(dep));
}
