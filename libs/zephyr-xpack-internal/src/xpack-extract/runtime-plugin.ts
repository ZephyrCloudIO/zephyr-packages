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

/** Fetches the zephyr-manifest.json file and returns the runtime plugin data */
async function fetchZephyrManifest(): Promise<RuntimePluginData | null> {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    // Fetch the manifest from the same origin
    const response = await fetch('/zephyr-manifest.json');

    if (!response.ok) {
      return null;
    }

    const manifest = await response.json();

    // Transform manifest dependencies to runtime plugin format
    const resolvedRemotes: RuntimePluginData['resolvedRemotes'] = {};

    if (manifest.dependencies) {
      Object.entries(manifest.dependencies).forEach(([name, dep]: [string, any]) => {
        resolvedRemotes[name] = {
          application_uid: dep.application_uid,
          remote_entry_url: dep.remote_entry_url,
          default_url: dep.default_url,
          name: dep.name,
          library_type: 'module', // Default library type
        };
      });
    }

    return {
      builder: 'webpack', // Default to webpack, can be overridden by resourceQuery
      resolvedRemotes,
    };
  } catch {
    return null;
  }
}

/**
 * Zephyr Runtime Plugin for Module Federation This plugin handles dynamic remote URL
 * resolution at runtime using compile-time information passed via __resourceQuery and
 * beforeRequest hook to mutate URLs on the fly
 */
export function createZephyrRuntimePlugin(): FederationRuntimePlugin {
  // Parse compile-time data from resourceQuery
  let runtimeData: RuntimePluginData | null = null;
  let manifestPromise: Promise<RuntimePluginData | null> | null = null;

  // Track which remotes have already been processed to avoid re-processing
  const processedRemotes = new Set<string>();

  // Initialize manifest fetching
  const initializeManifest = async (): Promise<RuntimePluginData | null> => {
    let loadSource = '';

    try {
      // Primary source: fetch the manifest file
      runtimeData = await fetchZephyrManifest();
      if (runtimeData) {
        loadSource = 'zephyr-manifest.json';
      }

      // Fallback for development: check resourceQuery
      if (!runtimeData && typeof __resourceQuery !== 'undefined' && __resourceQuery) {
        // Parse query string to get the 'ze' parameter
        const params = new URLSearchParams(__resourceQuery);
        const zeData = params.get('ze');

        if (zeData) {
          runtimeData = JSON.parse(zeData);
          loadSource = 'resourceQuery';
        }
      }
    } catch (error) {
      console.log('Failed to load manifest:', error);
    }

    return runtimeData;
  };

  // Start fetching manifest immediately
  manifestPromise = initializeManifest();

  return {
    name: 'zephyr-runtime-remote-resolver',
    async beforeRequest(args) {
      // Ensure manifest is loaded before processing
      await manifestPromise;

      if (!runtimeData) {
        return args;
      }

      const { builder, resolvedRemotes } = runtimeData;

      // For repack, we don't need to modify URLs
      if (builder === 'repack') {
        return args;
      }

      // Extract remote name from args.id (format: "remoteName/componentName")
      // initial hit will be "remoteName" but just in case, we can process all path requests too.
      const remoteName = args.id.split('/')[0];

      // Check if this remote has already been processed
      if (processedRemotes.has(remoteName)) {
        return args;
      }

      const resolvedRemote = resolvedRemotes[remoteName];
      if (!resolvedRemote) {
        return args;
      }

      if (resolvedRemote && args.options.remotes) {
        // Find the matching remote in the remotes array
        const targetRemote = args.options.remotes.find(
          (remote) =>
            hasEntry(remote) &&
            (remote.name === remoteName || remote.alias === remoteName)
        );

        if (targetRemote && hasEntry(targetRemote)) {
          const originalUrl = targetRemote.entry;
          // Get the resolved URL, checking session storage first
          const resolvedUrl = getResolvedRemoteUrl(resolvedRemote);

          // Only log if we're actually changing the URL
          if (originalUrl !== resolvedUrl) {
            console.log(
              `[Zephyr Runtime] Resolved ${remoteName}: ${originalUrl} → ${resolvedUrl}`
            );
          }

          // Update the remote entry URL
          targetRemote.entry = resolvedUrl;

          // Mark this remote as processed
          processedRemotes.add(remoteName);
        }
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
