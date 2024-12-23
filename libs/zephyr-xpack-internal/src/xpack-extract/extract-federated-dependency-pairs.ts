import { is_zephyr_dependency_pair, ZeDependencyPair } from 'zephyr-agent';

import { iterateFederationConfig } from './iterate-federation-config';
import { XPackConfiguration } from '../xpack.types';
import { ZephyrEngine } from 'zephyr-agent';
export function extractFederatedDependencyPairs(
  zephyr_engine: ZephyrEngine,
  config: XPackConfiguration<any>
): ZeDependencyPair[] {
  return iterateFederationConfig(zephyr_engine, config, (plugin) => {
    if (!plugin?.remotes) return;
    return Object.entries(plugin.remotes).map((remote) => {
      const [remote_name, remote_version] = remote;
      return {
        name: remote_name,
        version: remote_version,
      } as ZeDependencyPair;
    });
  })
    .flat()
    .filter(
      (dep): dep is ZeDependencyPair =>
        dep !== undefined && dep !== null && is_zephyr_dependency_pair(dep)
    );
}
