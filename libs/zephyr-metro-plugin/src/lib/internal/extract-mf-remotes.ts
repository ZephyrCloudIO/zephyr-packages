import type { ZeDependencyPair } from 'zephyr-agent';

export function extract_remotes_dependencies(
  remotes?: Record<string, string>
): ZeDependencyPair[] {
  if (!remotes) return [];

  const dependencyPairs: ZeDependencyPair[] = Object.entries(remotes).map(
    ([name, remote]) => {
      return { name, version: remote };
    }
  );

  return dependencyPairs;
}
