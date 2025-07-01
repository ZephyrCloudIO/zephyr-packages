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
 * Searches for a script tag with id="zephyr:dependencies" and parses its JSON content
 */
function getZephyrSnapshotData(): RuntimePluginData | null {
  if (typeof document === 'undefined') {
    return null;
  }

  try {
    console.log('[Plugin] Zephyr Runtime Plugin: Looking for zephyr:dependencies script tag');
    const depsScript = document.getElementById('zephyr:dependencies') as HTMLScriptElement;
    if (depsScript && depsScript.type === 'application/json') {
      const jsonContent = depsScript.textContent || depsScript.innerText;
      if (jsonContent) {
        console.log('[Plugin] Zephyr Runtime Plugin: Found dependencies script tag');
        const dependencies = JSON.parse(jsonContent);
        console.log('[Plugin] Zephyr Runtime Plugin: Parsed dependencies:', dependencies);
        return {
          builder: 'webpack', // Default to webpack, can be overridden by resourceQuery
          resolvedRemotes: dependencies
        };
      }
    } else {
      console.log('[Plugin] Zephyr Runtime Plugin: No zephyr:dependencies script tag found');
    }
  } catch (error) {
    console.error('[Plugin] Zephyr Runtime Plugin: Failed to parse dependencies data:', error);
  }

  return null;
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
    // First try to get data from zephyr:dependencies script tag
    runtimeData = getZephyrSnapshotData();
    if (runtimeData) {
      console.log('[Plugin] Zephyr Runtime Plugin: Loaded from zephyr:dependencies tag');
      console.log('[Plugin] Zephyr Runtime Plugin: Remote count:', Object.keys(runtimeData.resolvedRemotes).length);
    }

    // If no data from snapshot, fall back to resourceQuery
    if (!runtimeData && typeof __resourceQuery !== 'undefined' && __resourceQuery) {
      console.log('[Plugin] Zephyr Runtime Plugin: Checking resourceQuery:', __resourceQuery);
      // Parse query string to get the 'ze' parameter
      const params = new URLSearchParams(__resourceQuery);
      const zeData = params.get('ze');

      if (zeData) {
        runtimeData = JSON.parse(zeData);
        console.log('[Plugin] Zephyr Runtime Plugin: Loaded from resourceQuery');
        if (runtimeData) {
          console.log('[Plugin] Zephyr Runtime Plugin: Remote count:', Object.keys(runtimeData.resolvedRemotes).length);
        }
      }
    }
    
    if (runtimeData) {
      console.log('[Plugin] Zephyr Runtime Plugin: Resolved remotes:', Object.keys(runtimeData.resolvedRemotes));
      console.log('[Plugin] Zephyr Runtime Plugin: Remote details:', JSON.stringify(runtimeData.resolvedRemotes, null, 2));
    } else {
      console.log('[Plugin] Zephyr Runtime Plugin: No runtime data available');
    }
  } catch (error) {
    console.error('[Zephyr Runtime Plugin] Failed to parse runtime data:', error);
  }

  return {
    name: 'zephyr-runtime-remote-resolver',
    init(args) {
      console.log('[Plugin] Zephyr Runtime Plugin: init() called');
      if (!runtimeData) {
        console.warn('[Plugin] Zephyr Runtime Plugin: No runtime data available during init');
        return args;
      }

      console.log('[Plugin] Zephyr Runtime Plugin: Initialized with remotes:', Object.keys(runtimeData!.resolvedRemotes));
      return args;
    },
    beforeRequest(args) {
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
      
      console.log(`[Plugin] Zephyr Runtime Plugin: beforeRequest() called for ${args.id}`);

      // Check if this remote has already been processed
      if (processedRemotes.has(remoteName)) {
        console.log(`[Plugin] Zephyr Runtime Plugin: Remote ${remoteName} already processed, skipping`);
        return args;
      }

      const resolvedRemote = resolvedRemotes[remoteName];
      if (!resolvedRemote) {
        console.log(`[Plugin] Zephyr Runtime Plugin: No resolved remote found for ${remoteName}`);
        return args;
      }
      
      console.log(`[Plugin] Zephyr Runtime Plugin: Found resolved remote for ${remoteName}:`, resolvedRemote);
      
      if (resolvedRemote && args.options.remotes) {
        // Find the matching remote in the remotes array
        const targetRemote = args.options.remotes.find(
          (remote) => hasEntry(remote) &&
            (remote.name === remoteName || remote.alias === remoteName)
        );

        if (targetRemote && hasEntry(targetRemote)) {
          // Get the resolved URL, checking session storage first
          const resolvedUrl = getResolvedRemoteUrl(resolvedRemote);

          console.log(`[Plugin] Zephyr Runtime Plugin: ✅ Resolving ${remoteName}: ${targetRemote.entry} → ${resolvedUrl}`);

          // Update the remote entry URL
          targetRemote.entry = resolvedUrl;

          // Mark this remote as processed
          processedRemotes.add(remoteName);
        } else {
          console.log(`[Plugin] Zephyr Runtime Plugin: Could not find matching remote for ${remoteName} in options.remotes`);
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
  
  if (sessionEdgeURL) {
    console.log(`[Plugin] Zephyr Runtime Plugin: Found session storage override for ${resolvedRemote.application_uid}: ${sessionEdgeURL}`);
  }
  
  // Use session URL if available, otherwise use resolved URL
  let edgeUrl = sessionEdgeURL ?? resolvedRemote.remote_entry_url;

  // Handle versioned remotes (name@url format)
  if (edgeUrl.indexOf('@') !== -1) {
    const [, url] = edgeUrl.split('@') as [string, string];
    console.log(`[Plugin] Zephyr Runtime Plugin: Extracted URL from versioned format: ${edgeUrl} → ${url}`);
    edgeUrl = url;
  }

  return edgeUrl;
}

/** Default export for use with Module Federation runtime plugins array */
export default createZephyrRuntimePlugin;
