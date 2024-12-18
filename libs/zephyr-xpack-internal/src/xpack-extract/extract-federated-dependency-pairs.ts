import {
  is_zephyr_dependency_pair,
  ZeDependencyPair,
  readPackageJson,
} from 'zephyr-agent';

import { iterateFederationConfig } from './iterate-federation-config';
import { XPackConfiguration } from '../xpack.types';

export function extractFederatedDependencyPairs(
  config: XPackConfiguration<any>
): ZeDependencyPair[] {
  const { zephyrDependencies } = readPackageJson(config.context ?? process.cwd());
  if (zephyrDependencies) {
    return Object.entries(zephyrDependencies).map(([name, version]) => {
      return {
        name,
        version,
      } as ZeDependencyPair;
    });
  }
  return iterateFederationConfig(config, (plugin) => {
    if (!plugin._options.remotes) return null;
    return Object.entries(plugin._options.remotes).map((remote) => {
      const [remote_name, remote_version] = remote;
      return {
        name: remote_name,
        version: remote_version,
      } as ZeDependencyPair;
    });
  })
    .flat()
    .filter(is_zephyr_dependency_pair);
}
