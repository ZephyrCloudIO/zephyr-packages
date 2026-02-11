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

// Global cache key for storing manifest promises across all bundles
const globalCacheKey = '__ZEPHYR_MANIFEST_CACHE__';
const _global: any = typeof window !== 'undefined' ? window : globalThis;

/**
 * Gets the global manifest cache shared across all bundles (host + remotes). Ensures only
 * one fetch per unique manifest URL across the entire application.
 */
function getGlobalManifestCache(): Map<string, Promise<ZephyrManifest | undefined>> {
  if (!_global[globalCacheKey]) {
    _global[globalCacheKey] = new Map<string, Promise<ZephyrManifest | undefined>>();
  }
  return _global[globalCacheKey];
}

/**
 * Attempts to determine the base URL of the script that loaded this module. Uses
 * document.currentScript to detect the script origin in browser environments.
 *
 * @returns Base URL (protocol + host) or empty string if unable to determine
 */
function getScriptBaseUrl(): string {
  // Try document.currentScript (works in browsers with <script> tags)
  if (typeof document !== 'undefined' && document.currentScript) {
    try {
      const src = (document.currentScript as HTMLScriptElement).src;
      if (src) {
        const url = new URL(src);
        return `${url.protocol}//${url.host}`;
      }
    } catch {
      // Failed to parse URL, fall through to default
    }
  }

  // Fall back to empty string (will use relative path)
  return '';
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
  const defaultManifestUrl = `${getScriptBaseUrl()}/zephyr-manifest.json`;

  const { manifestUrl = defaultManifestUrl } = options;

  let processedRemotes: Record<string, ZephyrDependency> | undefined;

  /** Fetches the zephyr-manifest.json file (basic version without OTA) */
  async function fetchManifest(url: string): Promise<ZephyrManifest | undefined> {
    try {
      // Append a timestamp query param for SSR compatibility — Node.js fetch ignores
      // the `cache` option, so this ensures cache-busting in all environments.
      const cacheBustUrl = `${url}${url.includes('?') ? '&' : '?'}_t=${Date.now()}`;
      const response = await fetch(cacheBustUrl, { cache: 'no-cache' });

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

  // Get global cache and check if manifest was already fetched.
  // Uses "set if not present" to deduplicate concurrent calls from multiple bundles
  // (host + remotes) within the same page load. On a full page reload, JS re-evaluates
  // and the global Map is recreated, so a fresh fetch is always triggered.
  const manifestCache = getGlobalManifestCache();

  if (!manifestCache.has(manifestUrl)) {
    manifestCache.set(manifestUrl, fetchManifest(manifestUrl));
  }

  // Reuse cached promise from global cache
  const zephyrManifestPromise = manifestCache.get(manifestUrl);

  const plugin: FederationRuntimePlugin = {
    name: 'zephyr-runtime-remote-resolver',
    async beforeRequest(args) {
      const zephyrManifest = await zephyrManifestPromise;

      // Always re-resolve from fresh manifest to handle HMR and soft-reload scenarios
      processedRemotes = identifyRemotes(args, zephyrManifest);

      // Extract remote name from args.id (format: "remoteName/componentName")
      const remoteName = args.id.split('/')[0];

      if (!processedRemotes[remoteName]) {
        return args; // No matching remote found
      }

      // Get the resolved URL, checking session storage first.
      // Cache-busting is handled at the edge: the worker appends ?_zv=<snapshot_id>
      // to remote_entry_url values in zephyr-manifest.json at serve time.
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
