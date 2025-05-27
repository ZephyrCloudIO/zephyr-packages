import type { ZeResolvedDependency } from './resolve_remote_dependency';

export function is_zephyr_resolved_dependency(
  dep: ZeResolvedDependency | null
): dep is ZeResolvedDependency {
  return dep !== null;
}
