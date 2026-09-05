/**
 * Zephyr Runtime Plugin for Module Federation. This file MUST stay in ESM format (.mjs) for
 * Vite/Rollup compatibility.
 *
 * Keep this runtime logic aligned with the xpack runtime plugin at
 * `libs/zephyr-xpack-internal/src/xpack-extract/runtime-plugin.ts`.
 *
 * We intentionally duplicate logic in both plugins for now. Once zephyr-agent supports ESM runtime
 * exports, we can move to a shared runtime implementation.
 */

const globalCacheKey = '__ZEPHYR_MANIFEST_CACHE__';
const _global = typeof window !== 'undefined' ? window : globalThis;

function getGlobalManifestCache() {
  if (!_global[globalCacheKey]) {
    _global[globalCacheKey] = new Map();
  }
  return _global[globalCacheKey];
}

const manifestFileName = 'zephyr-manifest.json';

/**
 * Parses a fetchable http(s) URL. `blob:`, `data:` and `file:` modules have no usable origin (`new
 * URL('file:///a.js').origin === 'null'`), so they are rejected here rather than producing a
 * `null/zephyr-manifest.json` request.
 */
function toHttpUrl(value) {
  if (!value) {
    return undefined;
  }

  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : undefined;
  } catch {
    return undefined;
  }
}

/**
 * `document.currentScript` is always null inside an ES module, so the module's own URL is the ESM
 * equivalent of the classic script src the xpack plugin reads.
 */
function getModuleUrl() {
  try {
    return import.meta.url;
  } catch {
    return undefined;
  }
}

/**
 * Reads an explicit `<base href>` as a directory URL.
 *
 * The element has to be present: `document.baseURI` falls back to the page URL, so on a deep
 * client-side route (`/products/42`) it would place the manifest in the wrong directory.
 */
function getDocumentBaseUrl() {
  if (typeof document === 'undefined' || typeof document.querySelector !== 'function') {
    return undefined;
  }

  if (!document.querySelector('base[href]')) {
    return undefined;
  }

  try {
    // `new URL('.', ...)` keeps the directory and drops any file name, query or hash.
    return toHttpUrl(new URL('.', document.baseURI).href);
  } catch {
    return undefined;
  }
}

/**
 * Resolves the URL of the deployment's `zephyr-manifest.json`.
 *
 * The manifest is emitted at the deployment root, which is not necessarily the origin root: the
 * same artifact can be re-served under a subpath (a CDN mounting it on `/activate/`, say), and the
 * entry chunk itself may be nested, so the module's own directory is not a usable base either.
 */
export function resolveManifestUrl(moduleUrl) {
  const script = toHttpUrl(moduleUrl);
  const documentBase = getDocumentBaseUrl();

  // A `<base href>` describes where the document's routes live, so it only tells us about
  // the deployment root while the document and the module share an origin. Assets served
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
  // subpath deployments where the module URL is not inspectable.
  return `./${manifestFileName}`;
}

function getRemotes(args) {
  if (Array.isArray(args?.options?.remotes)) {
    return args.options.remotes;
  }

  if (Array.isArray(args?.userOptions?.remotes)) {
    return args.userOptions.remotes;
  }

  return [];
}

export default function createZephyrRuntimePlugin(options = {}) {
  const defaultManifestUrl = resolveManifestUrl(getModuleUrl());
  const { manifestUrl = defaultManifestUrl } = options;

  let processedRemotes;

  async function fetchManifest(url) {
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

  const manifestCache = getGlobalManifestCache();

  if (!manifestCache.has(manifestUrl)) {
    manifestCache.set(manifestUrl, fetchManifest(manifestUrl));
  }

  const zephyrManifestPromise = manifestCache.get(manifestUrl);

  return {
    name: 'zephyr-runtime-remote-resolver',
    async beforeRequest(args) {
      const zephyrManifest = await zephyrManifestPromise;

      if (!processedRemotes) {
        processedRemotes = identifyRemotes(args, zephyrManifest);
      }

      const remoteName = typeof args?.id === 'string' ? args.id.split('/')[0] : undefined;

      if (!remoteName || !processedRemotes[remoteName]) {
        return args;
      }

      const resolvedUrl = getResolvedRemoteUrl(processedRemotes[remoteName]);
      const remotes = getRemotes(args);

      const targetRemote = remotes.find(
        (remote) => hasEntry(remote) && (remote.name === remoteName || remote.alias === remoteName)
      );

      if (!targetRemote) {
        return args;
      }

      targetRemote.entry = resolvedUrl;

      return args;
    },
  };
}

function identifyRemotes(args, zephyrManifest) {
  const identifiedRemotes = {};

  if (!zephyrManifest) {
    return identifiedRemotes;
  }

  const remotes = getRemotes(args);
  if (!remotes.length) {
    return identifiedRemotes;
  }

  const dependencies = zephyrManifest.dependencies ?? {};

  remotes.forEach((remote) => {
    const resolvedRemote = dependencies[remote.name] ?? dependencies[remote.alias ?? ''];
    if (resolvedRemote) {
      identifiedRemotes[remote.name] = resolvedRemote;
      if (remote.alias && remote.alias !== remote.name) {
        identifiedRemotes[remote.alias] = resolvedRemote;
      }
    }
  });

  return identifiedRemotes;
}

function hasEntry(remote) {
  return (
    remote !== null &&
    remote !== undefined &&
    typeof remote === 'object' &&
    'entry' in remote &&
    typeof remote.entry === 'string'
  );
}

function getResolvedRemoteUrl(resolvedRemote) {
  const _window = typeof window !== 'undefined' ? window : globalThis;

  const sessionEdgeURL = _window.sessionStorage?.getItem?.(resolvedRemote.application_uid);

  let edgeUrl = sessionEdgeURL ?? resolvedRemote.remote_entry_url;

  if (edgeUrl.indexOf('@') !== -1) {
    const [, url] = edgeUrl.split('@');
    edgeUrl = url;
  }

  return edgeUrl;
}
