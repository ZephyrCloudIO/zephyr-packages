import { ZeDependencyPair } from 'zephyr-agent';
import { parseRemoteMap } from './remote_map_parser';

export function extract_remotes_dependencies(
  code: string,
  id: string
): ZeDependencyPair[] | undefined {
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
