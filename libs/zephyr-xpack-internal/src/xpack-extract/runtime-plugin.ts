import type {
  FederationRuntimePlugin,
  RemoteWithEntry,
} from '../types/module-federation.types';

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

    const manifest = await response.json().catch(() => null);

    if (!manifest) {
      return null;
    }

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
    try {
      // Primary source: fetch the manifest file
      runtimeData = await fetchZephyrManifest();

      // Fallback for development: check resourceQuery
      if (!runtimeData && typeof __resourceQuery !== 'undefined' && __resourceQuery) {
        // Parse query string to get the 'ze' parameter
        const params = new URLSearchParams(__resourceQuery);
        const zeData = params.get('ze');

        if (zeData) {
          runtimeData = JSON.parse(zeData);
        }
      }
    } catch (error) {
      console.error('Failed to load manifest:', error);
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

      const remotes = identifyRemotes(args, runtimeData, processedRemotes);

      if (!remotes) {
        return args;
      }

      const { targetRemote, resolvedRemote } = remotes;

      // Get the resolved URL, checking session storage first
      const resolvedUrl = getResolvedRemoteUrl(resolvedRemote);

      // Update the remote entry URL
      targetRemote.entry = resolvedUrl;

      // Mark this remote as processed
      processedRemotes.add(targetRemote.name);

      return args;
    },
  };
}

type Args = Parameters<NonNullable<FederationRuntimePlugin['beforeRequest']>>[0];
type IdentifiedRemotes = {
  targetRemote: RemoteWithEntry;
  resolvedRemote: RuntimePluginData['resolvedRemotes'][string];
};

function identifyRemotes(
  args: Args,
  runtimeData: RuntimePluginData | null,
  processedRemotes: Set<string>
): IdentifiedRemotes | undefined {
  // No runtime plugin configured
  if (!runtimeData) {
    return;
  }

  // No remotes defined
  if (!args.options.remotes.length) {
    return;
  }

  const { builder, resolvedRemotes } = runtimeData;

  // For repack, we don't need to modify URLs
  if (builder === 'repack') {
    return;
  }

  // Extract remote name from args.id (format: "remoteName/componentName")
  // initial hit will be "remoteName" but just in case, we can process all path requests too.
  const remoteName = args.id.split('/')[0];

  // Check if this remote has already been processed
  if (processedRemotes.has(remoteName)) {
    return;
  }

  // Find the matching remote in the remotes array
  const targetRemote = args.options.remotes.find(
    (remote) =>
      hasEntry(remote) && (remote.name === remoteName || remote.alias === remoteName)
  )!;

  const resolvedRemote = resolvedRemotes[targetRemote.alias ?? targetRemote.name];

  // Check for resolved remotes entry for this specific remote called
  // in runtime by the application
  if (!resolvedRemote) {
    return;
  }

  // Type guard to check if a remote has an entry property
  if (!hasEntry(targetRemote)) {
    return;
  }

  return { targetRemote, resolvedRemote };
}

function hasEntry(remote: any): remote is RemoteWithEntry {
  return (
    remote !== null &&
    remote !== undefined &&
    typeof remote === 'object' &&
    'entry' in remote &&
    typeof (remote as any).entry === 'string'
  );
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
