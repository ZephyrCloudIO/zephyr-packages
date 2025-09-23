import { ZEPHYR_MANIFEST_VERSION, type ZephyrDependency } from 'zephyr-edge-contract';
import type { ZeResolvedDependency } from '../../zephyr-engine/resolve_remote_dependency';
import { ze_log } from '../logging';

export function convertResolvedDependencies(
  dependencies: ZeResolvedDependency[]
): Record<string, ZephyrDependency> {
  return Object.fromEntries(
    dependencies.map((dep) => [
      dep.name,
      {
        name: dep.name,
        application_uid: dep.application_uid,
        remote_entry_url: dep.remote_entry_url,
        default_url: dep.default_url,
        library_type: dep.library_type,
      },
    ])
  );
}

export function createManifestContent(dependencies: ZeResolvedDependency[]): string {
  const dependencyCount = dependencies?.length || 0;
  ze_log.manifest('Creating manifest with dependencies:', dependencyCount);

  const dependenciesMap = convertResolvedDependencies(dependencies);

  ze_log.manifest(
    `Dependencies: ${dependencyCount ? Object.keys(dependenciesMap).join(', ') : 'none'}`
  );

  return JSON.stringify({
    version: ZEPHYR_MANIFEST_VERSION,
    timestamp: new Date().toISOString(),
    dependencies: dependenciesMap,
  });
}
