import type { ZephyrDependency, ZephyrManifest } from 'zephyr-edge-contract';
import type {
  BeforeRequestHookArgs,
  FederationRuntimePlugin,
  RemoteWithEntry,
} from '../types/module-federation.types';

export interface ZephyrRuntimePluginOTAOptions {
  /** Called when manifest changes are detected */
  onManifestChange?: (newManifest: ZephyrManifest, oldManifest?: ZephyrManifest) => void;
  /** Called when manifest fetch fails */
  onManifestError?: (error: Error) => void;
  /** Custom manifest URL (defaults to /zephyr-manifest.json) */
  manifestUrl?: string;
}

export interface ZephyrRuntimePluginInstance {
  /** Refresh the manifest and check for changes */
  refresh: () => Promise<ZephyrManifest | undefined>;
  /** Get the current cached manifest */
  getCurrentManifest: () => Promise<ZephyrManifest | undefined>;
}

// Ensure only one fetch is done by the app
const globalKey = '__ZEPHYR_MANIFEST_PROMISE__';
const _global = typeof window !== 'undefined' ? window : globalThis;

function getGlobalManifestPromise(): Promise<ZephyrManifest | undefined> | undefined {
  return (_global as any)[globalKey];
}

function setGlobalManifestPromise(promise: Promise<ZephyrManifest | undefined>): void {
  (_global as any)[globalKey] = promise;
}

/**
 * Enhanced Zephyr Runtime Plugin with caching by application_uid and refresh hooks
 * Now delegates to createZephyrRuntimePluginWithOTA for consistent behavior
 */
export function createZephyrRuntimePlugin(
  options: ZephyrRuntimePluginOTAOptions = {}
): FederationRuntimePlugin {
  // Use the enhanced version but only return the plugin for backward compatibility
  const { plugin } = createZephyrRuntimePluginWithOTA(options);
  return plugin;
}

/** Fetches the zephyr-manifest.json file and returns the runtime plugin data */
async function fetchZephyrManifest(): Promise<ZephyrManifest | undefined> {
  try {
    // Fetch the manifest from the same origin
    const response = await fetch('/zephyr-manifest.json');

    if (!response.ok) {
      return;
    }

    const manifest = await response.json().catch(() => undefined);

    if (!manifest) {
      console.error('Failed to parse manifest JSON');
      return;
    }

    return manifest;
  } catch {
    console.error('Unexpected error fetching manifest');
    return;
  }
}

function identifyRemotes(
  args: BeforeRequestHookArgs,
  zephyrManifest: ZephyrManifest | undefined
): Record<string, ZephyrDependency> {
  const identifiedRemotes: Record<string, ZephyrDependency> = {};

  // No runtime plugin configured
  if (!zephyrManifest) {
    return identifiedRemotes;
  }

  // No remotes defined
  if (!args.options.remotes.length) {
    return identifiedRemotes;
  }

  const { dependencies } = zephyrManifest;

  const remotes = args.options.remotes;

  remotes.forEach((remote) => {
    const resolvedRemote = dependencies[remote.name] ?? dependencies[remote.alias ?? ''];
    if (resolvedRemote) {
      // Map both the original remote name and alias to the resolved remote
      // Nx replaces aliases calls with the normalized name
      identifiedRemotes[remote.name] = resolvedRemote;
      if (remote.alias && remote.alias !== remote.name) {
        identifiedRemotes[remote.alias] = resolvedRemote;
      }
    }
  });

  return identifiedRemotes;
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
function getResolvedRemoteUrl(resolvedRemote: ZephyrDependency): string {
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

/**
 * Enhanced Zephyr Runtime Plugin with OTA support
 * Features:
 * - Manifest caching by application_uid
 * - Injected fetchManifest and onManifestChange hooks
 * - Typed event emission for remote URL changes
 * - Async refresh() method for re-fetching manifests
 */
export function createZephyrRuntimePluginWithOTA(
  options: ZephyrRuntimePluginOTAOptions = {}
): { plugin: FederationRuntimePlugin; instance: ZephyrRuntimePluginInstance } {
  const {
    onManifestChange,
    onManifestError,
    manifestUrl = '/zephyr-manifest.json',
  } = options;

  let processedRemotes: Record<string, ZephyrDependency> | undefined;
  let currentManifest: ZephyrManifest | undefined;

  // Cache manifests by application_uid for multi-app support
  const manifestCacheKey = `__ZEPHYR_MANIFEST_CACHE__`;
  const manifestCache: Record<string, {
    manifest: ZephyrManifest;
    timestamp: number;
    promise?: Promise<ZephyrManifest | undefined>;
  }> = (_global as any)[manifestCacheKey] || {};
  (_global as any)[manifestCacheKey] = manifestCache;

  function getCachedManifest(appUid?: string): ZephyrManifest | undefined {
    if (!appUid) return undefined;
    const cached = manifestCache[appUid];
    // Cache valid for 5 minutes
    if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
      return cached.manifest;
    }
    return undefined;
  }

  function setCachedManifest(manifest: ZephyrManifest): void {
    if (manifest.application_uid) {
      manifestCache[manifest.application_uid] = {
        manifest,
        timestamp: Date.now()
      };
    }
  }

  async function fetchManifestWithOTA(
    url: string,
    skipCache = false
  ): Promise<ZephyrManifest | undefined> {
    try {
      const response = await fetch(url);

      if (!response.ok) {
        return;
      }

      const newManifest = await response.json().catch(() => undefined);

      if (!newManifest) {
        const error = new Error('Failed to parse manifest JSON');
        onManifestError?.(error);
        console.error('Failed to parse manifest JSON');
        return;
      }

      // Check if manifest changed and emit typed events
      if (currentManifest && onManifestChange) {
        const hasChanged =
          newManifest.timestamp !== currentManifest.timestamp ||
          JSON.stringify(newManifest.dependencies) !==
            JSON.stringify(currentManifest.dependencies);

        if (hasChanged) {
          // Check for remote entry URL changes and emit typed events
          Object.keys(newManifest.dependencies).forEach((remoteName) => {
            const newDep = newManifest.dependencies[remoteName];
            const oldDep = currentManifest!.dependencies[remoteName];

            if (newDep && oldDep && newDep.remote_entry_url !== oldDep.remote_entry_url) {
              // Emit typed event for remote URL change
              const changeEvent = new CustomEvent('zephyr:remote-url-changed', {
                detail: {
                  remoteName,
                  oldUrl: oldDep.remote_entry_url,
                  newUrl: newDep.remote_entry_url,
                  manifest: newManifest
                }
              });

              if (typeof document !== 'undefined') {
                document.dispatchEvent(changeEvent);
              }
            }
          });

          onManifestChange(newManifest, currentManifest);
        }
      }

      // Cache the manifest by application_uid
      setCachedManifest(newManifest);
      currentManifest = newManifest;
      return newManifest;
    } catch (error) {
      const err =
        error instanceof Error ? error : new Error('Unknown manifest fetch error');
      onManifestError?.(err);
      console.error('Unexpected error fetching manifest:', error);
      return;
    }
  }

  // Start fetching manifest immediately, check cache first
  let zephyrManifestPromise: Promise<ZephyrManifest | undefined>;

  async function initializeManifest(): Promise<ZephyrManifest | undefined> {
    // Try to get from cache first if we know the application_uid
    const potentialManifest = await fetchManifestWithOTA(manifestUrl);
    if (potentialManifest?.application_uid) {
      const cached = getCachedManifest(potentialManifest.application_uid);
      if (cached) {
        currentManifest = cached;
        return cached;
      }
    }
    return potentialManifest;
  }

  zephyrManifestPromise = initializeManifest();

  const plugin: FederationRuntimePlugin = {
    name: 'zephyr-runtime-remote-resolver-ota',
    async beforeRequest(args) {
      const zephyrManifest = await zephyrManifestPromise;

      if (!processedRemotes) {
        processedRemotes = identifyRemotes(args, zephyrManifest);
      }

      // Extract remote name from args.id (format: "remoteName/componentName")
      const remoteName = args.id.split('/')[0];

      if (!processedRemotes[remoteName]) {
        return args; // No matching remote found
      }

      // Get the resolved URL, checking session storage first
      const resolvedUrl = getResolvedRemoteUrl(processedRemotes[remoteName]);

      const targetRemote = args.options.remotes.find(
        (remote) =>
          hasEntry(remote) && (remote.name === remoteName || remote.alias === remoteName)
      );

      if (!targetRemote) {
        return args;
      }

      // Update the remote entry URL
      targetRemote.entry = resolvedUrl;

      return args;
    },
  };

  const instance: ZephyrRuntimePluginInstance = {
    async refresh() {
      // Clear processed remotes to force re-identification
      processedRemotes = undefined;

      // Clear cache if we have the application_uid
      if (currentManifest?.application_uid) {
        delete manifestCache[currentManifest.application_uid];
      }

      // Fetch fresh manifest
      zephyrManifestPromise = fetchManifestWithOTA(manifestUrl, true);
      return zephyrManifestPromise;
    },

    async getCurrentManifest() {
      return zephyrManifestPromise;
    },
  };

  return { plugin, instance };
}

/** Default export for use with Module Federation runtime plugins array */
export default createZephyrRuntimePlugin;
