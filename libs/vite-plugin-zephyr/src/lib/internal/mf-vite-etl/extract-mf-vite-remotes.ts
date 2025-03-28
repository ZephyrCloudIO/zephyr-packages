import { ZeDependencyPair, readPackageJson } from 'zephyr-agent';
import { parseRemoteMap } from './remote_map_parser';

export function extract_remotes_dependencies(
  root: string,
  code: string,
  id: string
): ZeDependencyPair[] | undefined {
  const { zephyrDependencies } = readPackageJson(root);
  if (zephyrDependencies) {
    return Object.entries(zephyrDependencies).map(([name, version]) => {
      return {
        name,
        version,
      } as ZeDependencyPair;
    });
  }

  const dependencyPairs: ZeDependencyPair[] = [];
  const extractedRemotes = parseRemoteMap(code, id);
  if (extractedRemotes === undefined) return;

  const { remotesMap } = extractedRemotes;

  for (const remote of remotesMap) {
    const { name, entry: version } = remote;
    dependencyPairs.push({ name, version });
  }

  return dependencyPairs;
}
