import type { FederationRuntimePlugin } from '@module-federation/runtime';
import type { RemoteWithEntry } from '@module-federation/sdk';
// Webpack/Rspack-specific global for resourceQuery
declare const __resourceQuery: string | undefined;

interface RuntimePluginData {
  builder: string;
  resolvedRemotes: Record<
    string,
    {
      application_uid: string;
      remote_entry_url: string;
      default_url: string;
      name: string;
      library_type: string;
    }
  >;
}

// Type guard to check if a remote has an entry property
function hasEntry(remote: any): remote is RemoteWithEntry {
  return (
    remote !== null &&
    remote !== undefined &&
    typeof remote === 'object' &&
    'entry' in remote &&
    typeof (remote as any).entry === 'string'
  );
}

/**
 * Zephyr Runtime Plugin for Module Federation This plugin handles dynamic remote URL
 * resolution at runtime using compile-time information passed via __resourceQuery and
 * beforeRequest hook to mutate URLs on the fly
 */
export function createZephyrRuntimePlugin(): FederationRuntimePlugin {
  // Parse compile-time data from resourceQuery
  let runtimeData: RuntimePluginData | null = null;

  // Track which remotes have already been processed to avoid re-processing
  const processedRemotes = new Set<string>();

  try {
    if (typeof __resourceQuery !== 'undefined' && __resourceQuery) {
      // Parse query string to get the 'ze' parameter
      const params = new URLSearchParams(__resourceQuery);
      const zeData = params.get('ze');

      if (zeData) {
        runtimeData = JSON.parse(zeData);
      }
    }
  } catch (error) {
    console.warn('Zephyr Runtime Plugin: Failed to parse resourceQuery', error);
  }

  return {
    name: 'zephyr-runtime-remote-resolver',
    init(args) {
      if (!runtimeData) {
        console.warn('Zephyr Runtime Plugin: No runtime data available');
        return args;
      }

      console.log('Zephyr Runtime Plugin: Initialized with', runtimeData.resolvedRemotes);
      return args;
    },
    beforeRequest(args) {
      console.log('beforeRequest', args);
      if (!runtimeData) {
        return args;
      }
      console.log('runtimeData', runtimeData);

      const { builder, resolvedRemotes } = runtimeData;

      // For repack, we don't need to modify URLs
      if (builder === 'repack') {
        return args;
      }

      // Extract remote name from args.id (format: "remoteName/componentName")
      // initial hit will be "remoteName" but just in case, we can process all path requests too.
      const remoteName = args.id.split('/')[0];
      console.log('Looking for remote:', remoteName);

      // Check if this remote has already been processed
      if (processedRemotes.has(remoteName)) {
        console.log(`Zephyr: Remote ${remoteName} already processed, skipping`);
        return args;
      }

      const resolvedRemote = resolvedRemotes[remoteName];
      console.log('resolvedRemote', resolvedRemote);
      if (resolvedRemote && args.options.remotes) {
        // Find the matching remote in the remotes array
        const targetRemote = args.options.remotes.find(
          (remote) =>
            hasEntry(remote) &&
            (remote.name === remoteName || remote.alias === remoteName)
        );

        if (targetRemote && hasEntry(targetRemote)) {
          // Get the resolved URL, checking session storage first
          const resolvedUrl = getResolvedRemoteUrl(resolvedRemote);

          console.log(
            `Zephyr: Updating remote ${remoteName} entry from ${targetRemote.entry} to ${resolvedUrl}`
          );

          // Update the remote entry URL
          targetRemote.entry = resolvedUrl;

          // Mark this remote as processed
          processedRemotes.add(remoteName);
        } else {
          console.log(`Zephyr: Remote ${remoteName} not found in remotes array`);
        }
      } else {
        console.log(`Zephyr: No resolved remote data found for ${remoteName}`);
      }

      return args;
    },
  };
}

/** Resolves the actual remote URL, checking session storage for overrides */
function getResolvedRemoteUrl(
  resolvedRemote: RuntimePluginData['resolvedRemotes'][string]
): string {
  const _window = typeof window !== 'undefined' ? window : globalThis;

  // Check for session storage override (for development/testing)
  const sessionEdgeURL = _window.sessionStorage?.getItem(resolvedRemote.application_uid);

  // Use session URL if available, otherwise use resolved URL
  let edgeUrl = sessionEdgeURL ?? resolvedRemote.remote_entry_url;

  // Handle versioned remotes (name@url format)
  if (edgeUrl.indexOf('@') !== -1) {
    const [, url] = edgeUrl.split('@') as [string, string];
    edgeUrl = url;
  }

  return edgeUrl;
}

/** Default export for use with Module Federation runtime plugins array */
export default createZephyrRuntimePlugin;
