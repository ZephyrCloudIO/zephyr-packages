import type { ZephyrDependency, ZephyrManifest } from 'zephyr-edge-contract';
import type {
  BeforeRequestHookArgs,
  FederationRuntimePlugin,
  RemoteWithEntry,
} from '../types/module-federation.types';

/**
 * Keep this runtime logic aligned with the Vite runtime plugin at
 * `libs/vite-plugin-zephyr/src/lib/internal/mf-vite-etl/runtime_plugin.mjs`.
 *
 * We intentionally duplicate logic in both plugins for now. Once zephyr-agent supports
 * ESM runtime exports, we can move to a shared runtime implementation.
 */

/** Options for basic runtime plugin */
export interface ZephyrRuntimePluginOptions {
  /** Custom manifest URL (defaults to the deployment's `zephyr-manifest.json`) */
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

const manifestFileName = 'zephyr-manifest.json';

/**
 * Parses a fetchable http(s) URL. `blob:`, `data:` and `file:` scripts have no usable
 * origin (`new URL('file:///a.js').origin === 'null'`), so they are rejected here rather
 * than producing a `null/zephyr-manifest.json` request.
 */
function toHttpUrl(value: string | undefined): URL | undefined {
  if (!value) {
    return;
  }

  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : undefined;
  } catch {
    return;
  }
}

/** Reads the src of the classic script currently executing, when there is one. */
function getCurrentScriptSrc(): string | undefined {
  if (typeof document === 'undefined' || !document.currentScript) {
    return;
  }

  return (document.currentScript as HTMLScriptElement).src || undefined;
}

/**
 * Reads an explicit `<base href>` as a directory URL.
 *
 * The element has to be present: `document.baseURI` falls back to the page URL, so on a
 * deep client-side route (`/products/42`) it would place the manifest in the wrong
 * directory.
 */
function getDocumentBaseUrl(): URL | undefined {
  if (typeof document === 'undefined' || typeof document.querySelector !== 'function') {
    return;
  }

  if (!document.querySelector('base[href]')) {
    return;
  }

  try {
    // `new URL('.', ...)` keeps the directory and drops any file name, query or hash.
    return toHttpUrl(new URL('.', document.baseURI).href);
  } catch {
    return;
  }
}

/**
 * Resolves the URL of the deployment's `zephyr-manifest.json`.
 *
 * The manifest is emitted at the deployment root, which is not necessarily the origin
 * root: the same artifact can be re-served under a subpath (a CDN mounting it on
 * `/activate/`, say), and the entry chunk itself may be nested (rsbuild emits under
 * `static/js/`), so the script's own directory is not a usable base either.
 */
export function resolveManifestUrl(scriptUrl?: string): string {
  const script = toHttpUrl(scriptUrl);
  const documentBase = getDocumentBaseUrl();

  // A `<base href>` describes where the document's routes live, so it only tells us about
  // the deployment root while the document and the script share an origin. Assets served
  // from a separate CDN keep their own root and are handled below.
  if (documentBase && (!script || script.origin === documentBase.origin)) {
    // `href` of a directory URL always ends with `/`.
    return `${documentBase.href}${manifestFileName}`;
  }

  // Hostname-mode deployments live at the origin root.
  if (script) {
    return `${script.origin}/${manifestFileName}`;
  }

  // Document-relative on purpose: a leading `/` ignores `<base href>` entirely and breaks
  // subpath deployments that expose no classic script to inspect.
  return `./${manifestFileName}`;
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
  const defaultManifestUrl = resolveManifestUrl(getCurrentScriptSrc());

  const { manifestUrl = defaultManifestUrl } = options;

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

  // Get global cache and check if manifest was already fetched
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

      if (!processedRemotes) {
        processedRemotes = identifyRemotes(args, zephyrManifest);
      }

      // Extract remote name from args.id (format: "remoteName/componentName")
      const remoteName = args.id.split('/')[0];

      if (!processedRemotes[remoteName]) {
        return args; // No matching remote found
      }

      // Get the resolved entry, checking session storage first
      const resolvedEntry = getResolvedRemoteEntry(processedRemotes[remoteName]);

      const targetRemote = args.options.remotes.find(
        (remote) =>
          hasEntry(remote) && (remote.name === remoteName || remote.alias === remoteName)
      );

      if (!targetRemote) {
        return args;
      }

      targetRemote.entry = resolvedEntry.url;

      if (resolvedEntry.isManifest) {
        // The snapshot plugin derives the concrete entry type/global name from the MF
        // manifest. Keeping a stale direct-entry type here bypasses that contract.
        delete targetRemote.type;
      } else if (resolvedEntry.libraryType) {
        // Direct ESM remotes must reach the runtime with `type: module`; otherwise the
        // runtime attempts to load them as a classic global script.
        targetRemote.type = resolvedEntry.libraryType;
      }

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

interface ResolvedRemoteEntry {
  url: string;
  isManifest: boolean;
  libraryType?: string;
}

/** Resolves the actual remote entry, checking session storage for overrides. */
function getResolvedRemoteEntry(resolvedRemote: ZephyrDependency): ResolvedRemoteEntry {
  const _window = typeof window !== 'undefined' ? window : globalThis;

  // Check for session storage override (for development/testing)
  const sessionEdgeURL = _window.sessionStorage?.getItem(resolvedRemote.application_uid);

  // A session override is intentionally highest priority. Otherwise preserve the MF
  // manifest URL so the runtime can discover exposes, chunks, and remote entry type.
  let edgeUrl =
    sessionEdgeURL ?? resolvedRemote.manifest_url ?? resolvedRemote.remote_entry_url;

  // Handle versioned remotes (name@url format)
  edgeUrl = stripRemoteNamePrefix(edgeUrl);

  const pathname = edgeUrl.split(/[?#]/, 1)[0];
  const isManifest = pathname.endsWith('.json');

  return {
    url: edgeUrl,
    isManifest,
    libraryType: isManifest ? undefined : resolvedRemote.library_type,
  };
}

function stripRemoteNamePrefix(entry: string): string {
  if (/^(?:https?:)?\/\//.test(entry)) {
    return entry;
  }

  const absoluteUrlIndex = entry.search(/https?:\/\//);
  if (absoluteUrlIndex > 0) {
    return entry.slice(absoluteUrlIndex);
  }

  const separatorIndex = entry.lastIndexOf('@');
  if (separatorIndex !== -1) {
    return entry.slice(separatorIndex + 1);
  }

  return entry;
}

/** Default export for use with Module Federation runtime plugins array */
export default createZephyrRuntimePlugin;
