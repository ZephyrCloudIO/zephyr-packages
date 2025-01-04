import { ZeDependencyPair, readPackageJson } from 'zephyr-agent';
import { parseRemoteMap } from './remote_map_parser';
import { ModuleFederationOptions } from '../../vite-plugin-zephyr';

export function extract_remotes_dependencies(
  mf_config: ModuleFederationOptions | undefined,
  root: string,
  code: string,
  id: string
): ZeDependencyPair[] | undefined {
  const dependencyPairs: ZeDependencyPair[] = [];
  // first check if there are any zephyr dependencies in package.json
  const { zephyrDependencies } = readPackageJson(root);
  if (zephyrDependencies) {
    return Object.entries(zephyrDependencies).map(([name, version]) => {
      console.log('reading from package.json', name, version);
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
      console.log('mf_config.remotes.name', name, 'mf_config.remotes.entry', version.entry);
      return {
        name,
        version: version.entry,
      } as ZeDependencyPair;
    });
  }

  // if there are no remotes in the mf_config, check if there are any remotes in the code

  const extractedRemotes = parseRemoteMap(code, id);
  if (extractedRemotes === undefined) return;

  const { remotesMap } = extractedRemotes;

  console.log('extractedRemotes', Object.entries(remotesMap));

  for (const remote of remotesMap) {
    const { name, entry: version } = remote;
    dependencyPairs.push({ name, version });
  }

  return dependencyPairs;
}
