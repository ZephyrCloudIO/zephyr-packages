import { ZeResolvedDependency, ZephyrEngine, ze_log } from 'zephyr-agent';
import { InputOptions } from 'rolldown';
import { extractModuleFederationConfig } from './extract-module-federation-config';
import { ModuleFederationOptions } from '../zephyr-rolldown-plugin';
import { parseRemoteUrl } from './extract-remote-dependencies';
import { normalizedCompare } from './normalized-compare';

/**
 * Helper function to normalize names for dependency matching Handles differences between
 * hyphens and underscores in names
 */
function isMatchingDependency(
  dep: ZeResolvedDependency,
  remoteName: string,
  remoteUrl: string,
  parsedUrl: ReturnType<typeof parseRemoteUrl>
): boolean {
  // Use normalizedCompare for name matching
  const nameMatches = normalizedCompare(dep.name, remoteName);

  // Match either the full URL or the parsed URL part
  const versionMatches = dep.version === remoteUrl || dep.version === parsedUrl.url;

  const matches = nameMatches && versionMatches;
  console.log(
    `Checking dep: ${dep.name}@${dep.version} - Name match: ${nameMatches}, Version match: ${versionMatches}, Overall: ${matches}`
  );

  return matches;
}

/**
 * Updates module federation remotes with resolved dependency URLs
 *
 * @param zephyrEngine Initialized ZephyrEngine
 * @param options Rolldown input options
 * @param resolvedDeps Array of resolved dependencies
 */
export function updateRemoteUrls(
  zephyrEngine: ZephyrEngine,
  options: InputOptions,
  resolvedDeps: ZeResolvedDependency[] | null
): void {
  ze_log('===== BEGIN Zephyr Remote URL Update =====');

  if (!resolvedDeps?.length) {
    console.log('No resolved dependencies found, skipping remote URL updates');
    return;
  }

  console.log('Resolved dependencies:', JSON.stringify(resolvedDeps, null, 2));

  // Extract module federation config if any
  const mfConfig = extractModuleFederationConfig(options);
  if (!mfConfig || !mfConfig.remotes) {
    console.log('No module federation remotes found, skipping remote URL updates');
    return;
  }

  console.log('Original MF config remotes:', JSON.stringify(mfConfig.remotes, null, 2));

  // Define properly typed updatedRemotes variables based on the type of remotes
  let updatedRemotesArray: Record<string, string>[] = [];
  let updatedRemotesObject: Record<string, string> = {};

  let hasUpdates = false;

  // Update remote URLs with resolved dependencies
  if (mfConfig.remotes && Array.isArray(mfConfig.remotes)) {
    // Check for the current Rolldown format where each object has entry, name, entryGlobalName
    const hasEntryNameFormat =
      mfConfig.remotes.length > 0 &&
      'entry' in mfConfig.remotes[0] &&
      'name' in mfConfig.remotes[0];

    if (hasEntryNameFormat) {
      // For Rolldown MF, directly use the first remote and first resolved dependency
      // This is the simplest, most reliable approach for module federation
      const remoteObj: any = mfConfig.remotes[0];
      const remoteName = remoteObj.entryGlobalName || remoteObj.name;
      const remoteUrl = remoteObj.entry;
      const index = 0;

      if (resolvedDeps.length > 0) {
        // Find the matching resolved dependency by normalizing the names
        let resolvedDep = resolvedDeps.find(dep =>
          normalizedCompare(dep.name, remoteName)
        );

        // If not found by name, just use the first one as a fallback
        if (!resolvedDep) {
          resolvedDep = resolvedDeps[0];
        }

        // Instead of hard-coding URL replacements, use the provided remote_entry_url directly
        if (resolvedDep) {
          console.log(`Using resolved dependency URL: ${resolvedDep.remote_entry_url}`);
          // No manipulation needed, the Zephyr API provides the correct URL
        }

        console.log(
          `\n[USING DIRECT MATCH] Found dependency: ${resolvedDep.name}@${resolvedDep.version}`
        );
        console.log(`Remote entry URL: ${resolvedDep.remote_entry_url}`);
        console.log(`Application UID: ${resolvedDep.application_uid}`);

        // Parse the URL to handle prefixed format (name@url)
        const parsedUrl = parseRemoteUrl(remoteUrl);
        console.log(`Parsed URL:`, parsedUrl);

        // Create the updated URL
        let updatedUrl: string;
        // Use the remote_entry_url directly, which points to the remoteEntry.js file
        const newUrl = resolvedDep.remote_entry_url;
        updatedUrl = parsedUrl.prefix ? `${parsedUrl.prefix}@${newUrl}` : newUrl;
        console.log(`Transformed URL from ${remoteUrl} to ${updatedUrl}`);

        // Update the remote URL directly in the remoteObj
        if (
          updatedUrl !== remoteUrl &&
          mfConfig.remotes &&
          Array.isArray(mfConfig.remotes)
        ) {
          // Update the entry property
          mfConfig.remotes[index].entry = updatedUrl;
          hasUpdates = true;
          console.log(
            `Updated remote ${remoteName} entry from ${remoteUrl} to ${updatedUrl}`
          );
        } else {
          console.log(`No URL update needed for ${remoteName}`);
        }
      } else {
        console.log(`No resolved dependencies found for ${remoteName}`);
      }
    } else {
      // Handle array of remote objects (original Rolldown format)
      for (let index = 0; index < mfConfig.remotes.length; index++) {
        const remoteObj = mfConfig.remotes[index];
        console.log(`Processing remote object at index ${index}:`, remoteObj);

        // Each remoteObj is expected to be a single key-value pair like { "remoteName": "url" }
        const entries = Object.entries(remoteObj as Record<string, unknown>);
        if (entries.length === 0) {
          console.log(`Remote object at index ${index} has no entries, skipping`);
          continue;
        }

        const [remoteName, remoteUrl] = entries[0];

        if (typeof remoteUrl !== 'string') {
          console.log(`Remote ${remoteName} is not a string URL, skipping`);
          continue;
        }

        console.log(`\nProcessing remote: ${remoteName} with URL: ${remoteUrl}`);

        // Parse the URL to handle prefixed format (name@url)
        const parsedUrl = parseRemoteUrl(remoteUrl);
        console.log(`Parsed URL:`, parsedUrl);

        // Use the raw URL as the version, matching how we stored it
        const versionToFind = remoteUrl;

        console.log(`Looking for version: ${versionToFind}`);

        // Find the matching resolved dependency
        let matchedDep = null;
        for (const dep of resolvedDeps) {
          const nameMatches = normalizedCompare(dep.name, remoteName);
          const versionMatches =
            dep.version === versionToFind || dep.version === parsedUrl.url;
          const matches = nameMatches && versionMatches;
          console.log(
            `Checking dep: ${dep.name}@${dep.version} - Name match: ${nameMatches}, Version match: ${versionMatches}, Overall: ${matches}`
          );

          if (matches) {
            matchedDep = dep;
            break;
          }
        }

        if (!matchedDep) {
          console.log(
            `No resolved dependency found for remote: ${remoteName}@${versionToFind}`
          );

          // Try a fallback search by name only
          for (const dep of resolvedDeps) {
            if (normalizedCompare(dep.name, remoteName)) {
              console.log(
                `Found a fallback dependency by name only: ${dep.name}@${dep.version}`
              );
              console.log(`Resolved URL: ${dep.remote_entry_url}`);
              matchedDep = dep;
              break;
            }
          }

          if (!matchedDep) {
            continue; // Skip this remote if no match found
          }
        }

        console.log(
          `Found resolved dependency: ${matchedDep.name}@${matchedDep.version}`
        );
        console.log(`Resolved URL: ${matchedDep.remote_entry_url}`);

        let updatedUrl: string;

        // Use the remote_entry_url directly, which points to the remoteEntry.js file
        const newUrl = matchedDep.remote_entry_url;
        updatedUrl = parsedUrl.prefix ? `${parsedUrl.prefix}@${newUrl}` : newUrl;
        console.log(`Transformed URL from ${remoteUrl} to ${updatedUrl}`);

        // Update the remote URL in the array of remotes
        if (
          updatedUrl !== remoteUrl &&
          mfConfig.remotes &&
          Array.isArray(mfConfig.remotes)
        ) {
          // Create a new object with the updated URL
          const updatedRemoteObj = { [remoteName]: updatedUrl };

          // Update the array element
          mfConfig.remotes[index] = updatedRemoteObj;
          hasUpdates = true;
          console.log(`Updated remote ${remoteName} from ${remoteUrl} to ${updatedUrl}`);
        } else {
          console.log(`No URL update needed for ${remoteName}`);
        }
      }
    }
  } else if (mfConfig.remotes && typeof mfConfig.remotes === 'object') {
    // Handle object format (current Rolldown format with direct object)
    const remoteEntries = Object.entries(mfConfig.remotes);
    for (const [remoteName, remoteUrl] of remoteEntries) {
      if (typeof remoteUrl !== 'string') {
        console.log(`Remote ${remoteName} is not a string URL, skipping`);
        continue;
      }

      console.log(`\nProcessing remote: ${remoteName} with URL: ${remoteUrl}`);

      // Parse the URL to handle prefixed format (name@url)
      const parsedUrl = parseRemoteUrl(remoteUrl);
      console.log(`Parsed URL:`, parsedUrl);

      // Use the raw URL as the version, matching how we stored it
      const versionToFind = remoteUrl;

      console.log(`Looking for version: ${versionToFind}`);

      // Find the matching resolved dependency
      let matchedDep = null;
      for (const dep of resolvedDeps) {
        const nameMatches = normalizedCompare(dep.name, remoteName);
        const versionMatches =
          dep.version === versionToFind || dep.version === parsedUrl.url;
        const matches = nameMatches && versionMatches;
        console.log(
          `Checking dep: ${dep.name}@${dep.version} - Name match: ${nameMatches}, Version match: ${versionMatches}, Overall: ${matches}`
        );

        if (matches) {
          matchedDep = dep;
          break;
        }
      }

      if (!matchedDep) {
        console.log(
          `No resolved dependency found for remote: ${remoteName}@${versionToFind}`
        );

        // Try a fallback search by name only
        for (const dep of resolvedDeps) {
          if (normalizedCompare(dep.name, remoteName)) {
            console.log(
              `Found a fallback dependency by name only: ${dep.name}@${dep.version}`
            );
            console.log(`Resolved URL: ${dep.remote_entry_url}`);
            matchedDep = dep;
            break;
          }
        }

        if (!matchedDep) {
          continue; // Skip this remote if no match found
        }
      }

      console.log(`Found resolved dependency: ${matchedDep.name}@${matchedDep.version}`);
      console.log(`Resolved URL: ${matchedDep.remote_entry_url}`);

      let updatedUrl: string;
      // Use the remote_entry_url directly, which points to the remoteEntry.js file
      const newUrl = matchedDep.remote_entry_url;
      updatedUrl = parsedUrl.prefix ? `${parsedUrl.prefix}@${newUrl}` : newUrl;
      console.log(`Transformed URL from ${remoteUrl} to ${updatedUrl}`);

      // Update the remote URL only if it has changed
      if (
        updatedUrl !== remoteUrl &&
        typeof mfConfig.remotes === 'object' &&
        !Array.isArray(mfConfig.remotes)
      ) {
        // Update directly in the mfConfig object
        mfConfig.remotes[remoteName] = updatedUrl;

        // Also update our record object for compatibility with other code
        updatedRemotesObject[remoteName] = updatedUrl;

        hasUpdates = true;
        console.log(`Updated remote ${remoteName} from ${remoteUrl} to ${updatedUrl}`);
      } else {
        console.log(`No URL update needed for ${remoteName}`);
      }
    }
  }

  if (hasUpdates) {
    // Apply updates to the module federation plugin
    if (Array.isArray(mfConfig.remotes)) {
      console.log('Updated remotes array:', JSON.stringify(mfConfig.remotes, null, 2));
      // For array format, the updates were applied directly to mfConfig.remotes
      // No need to update the plugin because we modified the objects directly
      console.log('Direct modification of mfConfig.remotes array applied');
    } else {
      console.log(
        'Updated remotes object:',
        JSON.stringify(updatedRemotesObject, null, 2)
      );
      updateModuleFederationPlugin(options, mfConfig, updatedRemotesObject);
    }
  } else {
    console.log('No remote URLs were updated');
  }

  console.log('===== END Zephyr Remote URL Update =====');
}

/** Updates the module federation plugin configuration in the rolldown options */
function updateModuleFederationPlugin(
  options: InputOptions,
  mfConfig: ModuleFederationOptions,
  updatedRemotes: Record<string, string> | Array<Record<string, string>> | any[]
): void {
  if (!options.plugins) return;

  const pluginsArray = Array.isArray(options.plugins)
    ? options.plugins
    : [options.plugins].filter(Boolean);

  console.log('Searching for module federation plugin to update...');

  let pluginFound = false;

  // Update the plugin configuration
  for (let i = 0; i < pluginsArray.length; i++) {
    const plugin = pluginsArray[i];
    if (!plugin) continue;

    // Find module federation plugin by name
    if (
      (plugin as any).name === 'rolldown:module-federation' ||
      (plugin as any).name === 'builtin:module-federation'
    ) {
      console.log(`Found module federation plugin at index ${i}`);

      // For Rolldown's built-in module federation plugin
      if ((plugin as any).name === 'builtin:module-federation') {
        if (Array.isArray(mfConfig.remotes)) {
          // The updates have already been applied directly to mfConfig.remotes
          // We don't need to do anything here
          console.log('Remote URLs already updated in mfConfig array');
        } else {
          // If we're using the object format, update the plugin's options
          (plugin as any)._options.remotes = updatedRemotes;
          console.log('Updated module federation plugin remotes object');
        }
      } else {
        // For regular plugins
        (plugin as any).options.remotes = updatedRemotes;
        console.log('Updated module federation plugin remotes');
      }

      pluginFound = true;
      break;
    }

    // Check plugin constructor name for builtin plugins
    if ((plugin as any)._pluginName === 'builtin:module-federation') {
      console.log(`Found module federation plugin with _pluginName at index ${i}`);

      if (Array.isArray(mfConfig.remotes)) {
        // The updates have already been applied directly to mfConfig.remotes
        console.log('Remote URLs already updated in mfConfig array');
      } else {
        (plugin as any)._options.remotes = updatedRemotes;
        console.log('Updated builtin module federation plugin remotes');
      }

      pluginFound = true;
      break;
    }

    // Check if plugin has any properties that suggest it's a MF plugin
    if (plugin && typeof plugin === 'object') {
      console.log(
        `Inspecting plugin at index ${i}:`,
        Object.keys(plugin as any)
          .filter((k) => !k.startsWith('_'))
          .join(', ')
      );

      // Check for any options object that might contain MF config
      if ((plugin as any).options && (plugin as any).options.remotes) {
        console.log(`Found plugin with remotes at index ${i}`);

        if (Array.isArray(mfConfig.remotes)) {
          // The updates have already been applied directly to mfConfig.remotes
          console.log('Remote URLs already updated in mfConfig array');
        } else {
          (plugin as any).options.remotes = updatedRemotes;
          console.log('Updated plugin remotes directly');
        }

        pluginFound = true;
        break;
      }
    }
  }

  if (!pluginFound) {
    console.log('WARNING: Could not find module federation plugin to update!');
  }
}
