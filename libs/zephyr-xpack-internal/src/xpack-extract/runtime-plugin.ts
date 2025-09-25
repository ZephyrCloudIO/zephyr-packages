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
 * Zephyr Runtime Plugin for Module Federation This plugin handles dynamic remote URL
 * resolution at runtime using beforeRequest hook to mutate URLs on the fly
 */
export function createZephyrRuntimePlugin(): FederationRuntimePlugin {
  let processedRemotes: Record<string, ZephyrDependency> | undefined;

  // Start fetching manifest immediately
  let zephyrManifestPromise = getGlobalManifestPromise();

  if (!zephyrManifestPromise) {
    zephyrManifestPromise = fetchZephyrManifest();
    setGlobalManifestPromise(zephyrManifestPromise);
  }

  return {
    name: 'zephyr-runtime-remote-resolver',
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
 * Enhanced Zephyr Runtime Plugin with OTA support Maintains backward compatibility while
 * adding change notifications and refresh capabilities
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

  // Enhanced global key for OTA variant
  const otaGlobalKey = `__ZEPHYR_MANIFEST_PROMISE_OTA_${manifestUrl}__`;

  function getOTAManifestPromise(): Promise<ZephyrManifest | undefined> | undefined {
    return (_global as any)[otaGlobalKey];
  }

  function setOTAManifestPromise(promise: Promise<ZephyrManifest | undefined>): void {
    (_global as any)[otaGlobalKey] = promise;
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

      // Check if manifest changed
      if (currentManifest && onManifestChange) {
        const hasChanged =
          newManifest.timestamp !== currentManifest.timestamp ||
          JSON.stringify(newManifest.dependencies) !==
            JSON.stringify(currentManifest.dependencies);

        if (hasChanged) {
          onManifestChange(newManifest, currentManifest);
        }
      }

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

  // Start fetching manifest immediately
  let zephyrManifestPromise = getOTAManifestPromise();

  if (!zephyrManifestPromise) {
    zephyrManifestPromise = fetchManifestWithOTA(manifestUrl);
    setOTAManifestPromise(zephyrManifestPromise);
  }

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
      // Clear cache and fetch fresh
      delete (_global as any)[otaGlobalKey];
      processedRemotes = undefined;

      const promise = fetchManifestWithOTA(manifestUrl, true);
      setOTAManifestPromise(promise);
      zephyrManifestPromise = promise;

      return promise;
    },

    async getCurrentManifest() {
      return zephyrManifestPromise;
    },
  };

  return { plugin, instance };
}

/** Default export for use with Module Federation runtime plugins array */
export default createZephyrRuntimePlugin;
