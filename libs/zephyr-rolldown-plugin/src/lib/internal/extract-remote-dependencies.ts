import {
  ZeDependencyPair,
  readPackageJson,
  is_zephyr_dependency_pair,
  ze_log,
} from 'zephyr-agent';
import { extractModuleFederationConfig } from './extract-module-federation-config';
import type { InputOptions } from 'rolldown';

/**
 * Parse a module federation remote URL
 *
 * @param remoteUrl The URL string from the config
 * @returns Parsed components of the URL
 */
export function parseRemoteUrl(remoteUrl: string) {
  // Check for the format: name@url or just url
  const atSymbolIndex = remoteUrl.indexOf('@');

  if (atSymbolIndex === -1) {
    // Simple URL without prefix
    return {
      prefix: null,
      url: remoteUrl,
      isManifest: remoteUrl.includes('/mf-manifest.json') || remoteUrl.endsWith('.json'),
    };
  }

  // Format is name@url
  const prefix = remoteUrl.substring(0, atSymbolIndex);
  const url = remoteUrl.substring(atSymbolIndex + 1);

  return {
    prefix,
    url,
    isManifest: url.includes('/mf-manifest.json') || url.endsWith('.json'),
  };
}

/**
 * Extracts module federation remote dependencies from Rolldown configuration
 *
 * @param options Rolldown input options
 * @param rootDir Root directory context
 * @returns Array of dependency pairs
 */
export function extractRemoteDependencies(
  options: InputOptions,
  rootDir: string
): ZeDependencyPair[] {
  const depsPairs: ZeDependencyPair[] = [];

  // Extract dependencies from package.json
  try {
    const { zephyrDependencies } = readPackageJson(rootDir);
    if (zephyrDependencies) {
      Object.entries(zephyrDependencies).forEach(([name, version]) => {
        depsPairs.push({ name, version } as ZeDependencyPair);
      });
    }
  } catch (error) {
    console.warn('Could not read package.json:', error);
  }

  // Extract module federation plugin config
  const mfConfig = extractModuleFederationConfig(options);
  if (mfConfig?.remotes) {
    console.log('Found module federation remotes:', mfConfig.remotes);

    if (Array.isArray(mfConfig.remotes)) {
      // Check for the current Rolldown format where each object has entry, name, entryGlobalName
      const hasEntryNameFormat =
        mfConfig.remotes.length > 0 &&
        'entry' in mfConfig.remotes[0] &&
        'name' in mfConfig.remotes[0];

      if (hasEntryNameFormat) {
        // Handle current Rolldown format where each object has entry, name, entryGlobalName
        mfConfig.remotes.forEach((remoteObj: any, index) => {
          console.log(`Processing Rolldown remote object at index ${index}:`, remoteObj);

          // Extract the name, entryGlobalName, and entry URL
          const remoteName = remoteObj.entryGlobalName || remoteObj.name;
          const remoteUrl = remoteObj.entry;

          if (typeof remoteName === 'string' && typeof remoteUrl === 'string') {
            console.log(`Extracted remoteName: ${remoteName}, remoteUrl: ${remoteUrl}`);

            // Parse the remote URL to handle the new format
            const parsedUrl = parseRemoteUrl(remoteUrl);
            console.log(`Parsed remote URL for ${remoteName}:`, parsedUrl);

            // For manifest URLs, keep the URL as is with no additional prefixes
            const version = remoteUrl;

            // Store the parsed information for later use
            console.log(`Adding dependency pair: ${remoteName}@${version}`);
            depsPairs.push({
              name: remoteName,
              version: version,
            } as ZeDependencyPair);
          }
        });
      } else {
        // Handle array of remote objects (original Rolldown format)
        mfConfig.remotes.forEach((remoteObj, index) => {
          console.log(`Processing remote object at index ${index}:`, remoteObj);

          // Each remoteObj is expected to be a single key-value pair like { "remoteName": "url" }
          const entries = Object.entries(remoteObj);
          if (entries.length > 0) {
            const [remoteName, remoteUrl] = entries[0];

            console.log(`Extracted remoteName: ${remoteName}, remoteUrl: ${remoteUrl}`);

            if (typeof remoteUrl === 'string') {
              // Parse the remote URL to handle the new format
              const parsedUrl = parseRemoteUrl(remoteUrl);
              console.log(`Parsed remote URL for ${remoteName}:`, parsedUrl);

              // Just use the URL directly as is, regardless of manifest or not
              const version = remoteUrl;

              // Store the parsed information for later use
              console.log(`Adding dependency pair: ${remoteName}@${version}`);
              depsPairs.push({
                name: remoteName,
                version: version,
              } as ZeDependencyPair);
            }
          }
        });
      }
    } else {
      // Handle object format (direct key-value pairs)
      Object.entries(mfConfig.remotes).forEach(([remoteName, remoteUrl]) => {
        console.log(`Processing direct remote: ${remoteName} with URL: ${remoteUrl}`);
        if (typeof remoteUrl === 'string') {
          // Parse the remote URL to handle the new format
          const parsedUrl = parseRemoteUrl(remoteUrl);
          console.log(`Parsed remote URL for ${remoteName}:`, parsedUrl);

          // Just use the URL directly as the version, no special prefix for manifests
          const version = remoteUrl;

          // Store the parsed information for later use
          console.log(`Adding dependency pair: ${remoteName}@${version}`);
          depsPairs.push({
            name: remoteName,
            version: version,
          } as ZeDependencyPair);
        }
      });
    }
  }

  return depsPairs.filter((dep): dep is ZeDependencyPair =>
    is_zephyr_dependency_pair(dep)
  );
}
