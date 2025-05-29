import type { ZeDependencyPair } from 'zephyr-agent';
import { is_zephyr_dependency_pair, readPackageJson } from 'zephyr-agent';

import type { XFederatedConfig, XPackConfiguration } from '../xpack.types';
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

  iterateFederatedRemoteConfig(config, (remotesConfig: XFederatedConfig) => {
    if (!remotesConfig?.remotes) return;

    const remoteEntries = parseRemotesAsEntries(remotesConfig.remotes);

    remoteEntries.forEach(([remote_name, remote_version]) => {
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

/** Returns an Array of [remote_name, remote_version] */
export function parseRemotesAsEntries(
  remotes: XFederatedConfig['remotes']
): [string, string][] {
  if (!remotes) return [];

  const remotePairs: [string, string][] = [];
  const remoteEntries = Array.isArray(remotes) ? remotes : Object.entries(remotes);

  remoteEntries.map((remote) => {
    if (Array.isArray(remote)) {
      // Case where remotes are declared as:
      // Record<remote_name: string, remote_version: string | RemotesConfig>
      // e.g. ['remote_name', { url: 'remote_url' }]
      const version =
        typeof remote[1] === 'string' ? remote[1] : JSON.stringify(remote[1]);
      remotePairs.push([remote[0], version]);
    } else if (typeof remote === 'string') {
      // Case where remotes are declared as string (Nx's default remotes)
      remotePairs.push([remote, remote]);
    } else {
      // Fallback case where remotes are nested RemotesConfig objects
      Object.entries(remote).forEach(([name, config]) => {
        const version = typeof config === 'string' ? config : JSON.stringify(config);
        remotePairs.push([name, version]);
      });
    }
  });

  return remotePairs;
}
