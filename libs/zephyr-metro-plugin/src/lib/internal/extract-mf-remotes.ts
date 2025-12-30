import {
  is_zephyr_dependency_pair,
  readPackageJson,
  type ZeDependencyPair,
} from 'zephyr-agent';
import type { ZephyrCommandWrapperConfig } from '../zephyr-metro-plugin';

export function extract_remotes_dependencies(
  config: ZephyrCommandWrapperConfig
): ZeDependencyPair[] {
  const depsPairs: ZeDependencyPair[] = [];

  const { zephyrDependencies } = readPackageJson(config.context ?? process.cwd());
  if (zephyrDependencies) {
    Object.entries(zephyrDependencies).map(([name, version]) => {
      depsPairs.push({ name, version } as ZeDependencyPair);
    });
  }

  if (config.mfConfig?.remotes) {
    Object.entries(config.mfConfig.remotes).map(([name, remote]) => {
      depsPairs.push({ name, version: remote } as ZeDependencyPair);
    });
  }

  return depsPairs
    .flat()
    .filter((dep): dep is ZeDependencyPair => is_zephyr_dependency_pair(dep));
}
