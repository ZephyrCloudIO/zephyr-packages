import {
  is_zephyr_dependency_pair,
  ZeDependencyPair,
  readPackageJson,
} from 'zephyr-agent';

import { iterateFederationConfig } from './iterate-federation-config';
import { XPackConfiguration } from '../xpack.types';
import { ZephyrEngine } from 'zephyr-agent';
export function extractFederatedDependencyPairs(
  zephyr_engine: ZephyrEngine,
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
