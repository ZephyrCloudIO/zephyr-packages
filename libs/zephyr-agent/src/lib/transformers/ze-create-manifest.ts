import { createHash } from 'node:crypto';
import type {
  ZeBuildAsset,
  ZephyrDependency,
  ZephyrManifest,
} from 'zephyr-edge-contract';
import type { ZeResolvedDependency } from '../../zephyr-engine/resolve_remote_dependency';
import { ze_log } from '../logging';

/**
 * Creates a zephyr-manifest.json file with resolved dependencies
 *
 * @param dependencies - The resolved dependencies from the build
 * @returns The manifest content and the asset object
 */
export function createZephyrManifest(dependencies: ZeResolvedDependency[]): {
  content: string;
  asset: ZeBuildAsset;
} {
  const content = createManifestContent(dependencies);
  const asset = createManifestAsset(content);

  return { content, asset };
}

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
    version: 1,
    timestamp: new Date().toISOString(),
    dependencies: dependenciesMap,
  };

  ze_log.manifest(`Dependencies: ${Object.keys(dependenciesMap).join(', ') || 'none'}`);

  // Convert to JSON string
  return JSON.stringify(manifest);
}

export function createManifestAsset(content: string): ZeBuildAsset {
  const contentBuffer = Buffer.from(content);

  // Calculate hash for the content
  const hash = createHash('sha256')
    .update(content + 'zephyr-manifest.json')
    .digest('hex');

  // Return the asset object
  return {
    path: 'zephyr-manifest.json',
    extname: '.json',
    hash,
    size: contentBuffer.length,
    buffer: contentBuffer,
  };
}
