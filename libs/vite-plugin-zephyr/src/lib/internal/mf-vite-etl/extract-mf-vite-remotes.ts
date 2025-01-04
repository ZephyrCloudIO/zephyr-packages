import { ZeDependencyPair, readPackageJson } from 'zephyr-agent';
import { parseRemoteMap } from './remote_map_parser';
import { ModuleFederationOptions } from '../../vite-plugin-zephyr';

export function extract_remotes_dependencies(
  mf_config: ModuleFederationOptions | undefined,
  root: string
): ZeDependencyPair[] | undefined {
  // first check if there are any zephyr dependencies in package.json
  const { zephyrDependencies } = readPackageJson(root);
  if (zephyrDependencies) {
    return Object.entries(zephyrDependencies).map(([name, version]) => {
      return {
        name,
        version,
      };
    });
  }

  // if mf_config exists, extract dependency pairs from mf_config

  if (mf_config && mf_config.remotes) {
    return Object.entries(mf_config.remotes).map(([name, version]) => {
      if (typeof version === 'string') {
        return {
          name,
          version,
        };
      }

      return {
        name,
        version: version.entry,
      } as ZeDependencyPair;
    });
  }

  return;
}
