import { calculateManifestHash, generateManifestContent } from '../env-variables';

export interface ManifestAssetResult {
  content: string;
  hash: string;
  size: number;
}

/**
 * Generate a zephyr-manifest.json asset for an environment Merges version-level and
 * environment-level variables
 *
 * @param versionVars - Variables from the version's manifest
 * @param envVars - Environment-specific variables (take priority)
 * @returns Manifest content, hash, and size
 */
export async function generateEnvironmentManifest(
  versionVars: Record<string, string>,
  envVars: Record<string, string>
): Promise<ManifestAssetResult> {
  // Merge variables with environment taking priority
  const mergedVars = { ...versionVars, ...envVars };

  // Generate manifest content
  const content = generateManifestContent(mergedVars);

  if (!content) {
    // Return empty manifest if no variables
    const emptyContent = JSON.stringify({ zeVars: {} }, null, 2);
    return {
      content: emptyContent,
      hash: calculateManifestHash(emptyContent),
      size: Buffer.byteLength(emptyContent, 'utf8'),
    };
  }

  const hash = calculateManifestHash(content);
  const size = Buffer.byteLength(content, 'utf8');

  return {
    content,
    hash,
    size,
  };
}

/**
 * Extract variables from a manifest content string
 *
 * @param manifestContent - JSON content of a zephyr-manifest.json file
 * @returns The zeVars object from the manifest
 */
export function extractManifestVars(manifestContent: string): Record<string, string> {
  try {
    const manifest = JSON.parse(manifestContent);
    return manifest.zeVars || {};
  } catch (error) {
    console.error('Failed to parse manifest content:', error);
    return {};
  }
}
