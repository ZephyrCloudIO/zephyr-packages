export interface ZeDependencyPair {
  name: string;
  version: string;
}

export function is_zephyr_dependency_pair(
  dep: ZeDependencyPair | undefined | null
): dep is ZeDependencyPair {
  return !!dep;
}
