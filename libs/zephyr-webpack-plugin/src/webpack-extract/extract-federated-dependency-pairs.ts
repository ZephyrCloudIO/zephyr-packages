import { is_zephyr_dependency_pair, ZeDependencyPair } from 'zephyr-agent';
import { WebpackConfiguration } from '../types/missing-webpack-types';
import { iterateFederationConfig } from './iterate-federation-config';

export function extractFederatedDependencyPairs(
  config: WebpackConfiguration
): ZeDependencyPair[] {
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
