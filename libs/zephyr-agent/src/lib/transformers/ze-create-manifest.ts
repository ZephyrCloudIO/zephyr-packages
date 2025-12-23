import { createHash } from 'node:crypto';
import {
  ZEPHYR_MANIFEST_VERSION,
  type ZeBuildAsset,
  type ZephyrDependency,
  type ZephyrManifest,
} from 'zephyr-edge-contract';
import type { ZeResolvedDependency } from '../../zephyr-engine/resolve_remote_dependency';
import { ze_log } from '../logging';
import { collectZEPublicVars } from '../env-variables';

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

/**
 * Creates a zephyr-manifest.json file with resolved dependencies and environment
 * variables
 *
 * @param dependencies - The resolved dependencies from the build
 * @param includeEnvVars - Whether to include environment variables in the manifest
 * @returns The manifest content and the asset object
 */
export function createZephyrManifest(
  dependencies: ZeResolvedDependency[],
  includeEnvVars = true
): {
  content: string;
  asset: ZeBuildAsset;
} {
  const content = createManifestContent(dependencies, includeEnvVars);
  const asset = createManifestAsset(content);

  return { content, asset };
}

export function createManifestContent(
  dependencies: ZeResolvedDependency[],
  includeEnvVars = true
): string {
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
      // Include version info for OTA update detection
      snapshot_id: dep.snapshot_id,
      published_at: dep.published_at,
      version_url: dep.version_url,
    };
  });

  // Create the manifest object
  const manifest: ZephyrManifest = {
    version: ZEPHYR_MANIFEST_VERSION,
    timestamp: new Date().toISOString(),
    dependencies: dependenciesMap,
    zeVars: {},
  };

  // Add environment variables if requested
  if (includeEnvVars) {
    const envVars = collectZEPublicVars(process.env);
    if (Object.keys(envVars).length > 0) {
      manifest.zeVars = envVars;
      ze_log.manifest(
        `Environment variables: ${Object.keys(envVars).length} ZE_PUBLIC_* vars`
      );
    }
  }

  ze_log.manifest(`Dependencies: ${Object.keys(dependenciesMap).join(', ') || 'none'}`);

  // Convert to JSON string with pretty printing
  return JSON.stringify(manifest, null, 2);
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
