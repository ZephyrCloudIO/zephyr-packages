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

function getScriptBaseUrl() {
  if (typeof document !== 'undefined' && document.currentScript) {
    try {
      const src = document.currentScript.src;
      if (src) {
        const url = new URL(src);
        return `${url.protocol}//${url.host}`;
      }
    } catch {
      // Failed to parse URL, fall through to default.
    }
  }

  return '';
}

function getInjectedManifestUrl() {
  if (typeof document === 'undefined') {
    return;
  }

  const manifestUrl = document
    .querySelector('meta[name="zephyr-manifest"]')
    ?.getAttribute('content')
    ?.trim();

  return manifestUrl || undefined;
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
  const defaultManifestUrl = `${getScriptBaseUrl()}/zephyr-manifest.json`;
  const manifestUrl = options.manifestUrl ?? getInjectedManifestUrl() ?? defaultManifestUrl;

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

      const resolvedEntry = getResolvedRemoteEntry(processedRemotes[remoteName]);
      const remotes = getRemotes(args);

      const targetRemote = remotes.find(
        (remote) => hasEntry(remote) && (remote.name === remoteName || remote.alias === remoteName)
      );

      if (!targetRemote) {
        return args;
      }

      targetRemote.entry = resolvedEntry.url;

      if (resolvedEntry.isManifest) {
        delete targetRemote.type;
      } else if (resolvedEntry.libraryType) {
        targetRemote.type = resolvedEntry.libraryType;
      }

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

function getResolvedRemoteEntry(resolvedRemote) {
  const _window = typeof window !== 'undefined' ? window : globalThis;

  const sessionEdgeURL = _window.sessionStorage?.getItem?.(resolvedRemote.application_uid);

  let edgeUrl = sessionEdgeURL ?? resolvedRemote.manifest_url ?? resolvedRemote.remote_entry_url;

  edgeUrl = stripRemoteNamePrefix(edgeUrl);

  const pathname = edgeUrl.split(/[?#]/, 1)[0];
  const isManifest = pathname.endsWith('.json');

  return {
    url: edgeUrl,
    isManifest,
    libraryType: isManifest ? undefined : resolvedRemote.library_type,
  };
}

function stripRemoteNamePrefix(entry) {
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
