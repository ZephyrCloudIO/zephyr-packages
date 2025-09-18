import {
  ZEPHYR_MANIFEST_VERSION,
  type ZephyrDependency,
  type ZephyrManifest,
} from 'zephyr-edge-contract';
import type { ZeResolvedDependency } from '../../zephyr-engine/resolve_remote_dependency';
import { ze_log } from '../logging';

export function createManifestContent(dependencies: ZeResolvedDependency[]): string {
  ze_log.manifest('Creating manifest with dependencies:', dependencies?.length || 0);
  // Build the dependencies object
  const dependenciesMap: Record<string, ZephyrDependency> = {};

  dependencies.forEach((dep) => {
    dependenciesMap[dep.name] = {
      name: dep.name,
      application_uid: dep.application_uid,
      remote_entry_url: dep.remote_entry_url,
      default_url: dep.default_url,
      library_type: dep.library_type,
    };
  });

  // Create the manifest object
  const manifest: ZephyrManifest = {
    version: ZEPHYR_MANIFEST_VERSION,
    timestamp: new Date().toISOString(),
    dependencies: dependenciesMap,
  };

  ze_log.manifest(`Dependencies: ${Object.keys(dependenciesMap).join(', ') || 'none'}`);

  // Convert to JSON string
  return JSON.stringify(manifest);
}
