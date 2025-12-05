import type { ZephyrDependency, ZephyrManifest } from 'zephyr-edge-contract';
import type {
  BeforeRequestHookArgs,
  FederationRuntimePlugin,
  RemoteWithEntry,
} from '../types/module-federation.types';

/** Options for basic runtime plugin */
export interface ZephyrRuntimePluginOptions {
  /** Custom manifest URL (defaults to /zephyr-manifest.json) */
  manifestUrl?: string;
}

/**
 * Basic Zephyr Runtime Plugin (no OTA features) Suitable for web applications that don't
 * need OTA updates
 *
 * Features:
 *
 * - Simple manifest fetching
 * - Remote URL resolution
 * - Session storage override support
 *
 * For mobile applications with OTA support, use createZephyrRuntimePluginMobile
 */
export function createZephyrRuntimePlugin(
  options: ZephyrRuntimePluginOptions = {}
): FederationRuntimePlugin {
  const { manifestUrl = '/zephyr-manifest.json' } = options;

  let processedRemotes: Record<string, ZephyrDependency> | undefined;

  /** Fetches the zephyr-manifest.json file (basic version without OTA) */
  async function fetchManifest(url: string): Promise<ZephyrManifest | undefined> {
    try {
      const response = await fetch(url);

      if (!response.ok) {
        return;
      }

      const manifest = await response.json().catch(() => undefined);

      if (!manifest) {
        console.error('[Zephyr] Failed to parse manifest JSON');
        return;
      }

      return manifest;
    } catch (error) {
      console.error('[Zephyr] Unexpected error fetching manifest:', error);
      return;
    }
  }

  // Initialize manifest fetching
  const zephyrManifestPromise = fetchManifest(manifestUrl);

  const plugin: FederationRuntimePlugin = {
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

  return plugin;
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

/** Default export for use with Module Federation runtime plugins array */
export default createZephyrRuntimePlugin;
