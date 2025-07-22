import { createHash } from 'node:crypto';
import type { ZeBuildAsset } from 'zephyr-edge-contract';
import type { ZeResolvedDependency } from '../../zephyr-engine/resolve_remote_dependency';
import { ze_log } from '../logging';

interface ZephyrDependency {
  name: string;
  application_uid: string;
  remote_entry_url: string;
  default_url: string;
}

interface ZephyrManifest {
  version: string;
  timestamp: string;
  dependencies: Record<string, ZephyrDependency>;
}

/**
 * Creates a zephyr-manifest.json file with resolved dependencies
 *
 * @param dependencies - The resolved dependencies from the build
 * @returns The manifest content and the asset object
 */
export function createZephyrManifest(dependencies: ZeResolvedDependency[] | null): {
  content: string;
  asset: ZeBuildAsset;
} {
  ze_log.manifest('Creating manifest with dependencies:', dependencies?.length || 0);

  // Build the dependencies object
  const dependenciesMap: Record<string, ZephyrDependency> = {};

  if (dependencies && dependencies.length > 0) {
    dependencies.forEach((dep) => {
      dependenciesMap[dep.name] = {
        name: dep.name,
        application_uid: dep.application_uid,
        remote_entry_url: dep.remote_entry_url,
        default_url: dep.default_url,
      };
    });
  }

  // Create the manifest object
  const manifest: ZephyrManifest = {
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    dependencies: dependenciesMap,
  };

  // Convert to JSON string
  const content = JSON.stringify(manifest, null, 2);
  const contentBuffer = Buffer.from(content);

  // Calculate hash for the content
  const hash = createHash('sha256')
    .update(content + 'zephyr-manifest.json')
    .digest('hex');

  // Create the asset object
  const asset: ZeBuildAsset = {
    path: 'zephyr-manifest.json',
    extname: '.json',
    hash,
    size: contentBuffer.length,
    buffer: contentBuffer,
  };

  ze_log.manifest('Created manifest asset:');
  ze_log.manifest(
    `  - Dependencies: ${Object.keys(dependenciesMap).join(', ') || 'none'}`
  );

  return { content, asset };
}
