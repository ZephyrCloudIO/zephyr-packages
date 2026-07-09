/**
 * Zephyr Runtime Plugin for Module Federation. This file MUST stay in ESM
 * format (.mjs) for Vite/Rollup compatibility.
 *
 * Keep this runtime logic aligned with the xpack runtime plugin at
 * `libs/zephyr-xpack-internal/src/xpack-extract/runtime-plugin.ts`.
 *
 * We intentionally duplicate logic in both plugins for now. Once zephyr-agent
 * supports ESM runtime exports, we can move to a shared runtime
 * implementation.
 */

const globalCacheKey = '__ZEPHYR_MANIFEST_CACHE__';
const _global = typeof window !== 'undefined' ? window : globalThis;

function getGlobalManifestCache() {
  if (!_global[globalCacheKey]) {
    _global[globalCacheKey] = new Map();
  }
  return _global[globalCacheKey];
}

/**
 * Attempts to determine the deployment root of the script that loaded this
 * module. `zephyr-manifest.json` is emitted at the deployment root, so the base
 * must not depend on where the entry chunk is nested (e.g. `assets/`).
 *
 * Path-addressed deployments keep the reserved
 * `/__zephyr/v1/{v|t|e}/<route-key>` route base; hostname-mode deployments
 * resolve to the origin. Note: `document.currentScript` is null inside ES
 * modules, so Vite ESM output falls back to a relative manifest path.
 */
function getScriptBaseUrl() {
  if (typeof document !== 'undefined' && document.currentScript) {
    try {
      const src = document.currentScript.src;
      if (src) {
        const url = new URL(src);
        const routeBase = /^\/__zephyr\/v1\/[vte]\/[^/]+/.exec(url.pathname);
        return routeBase ? `${url.origin}${routeBase[0]}` : url.origin;
      }
    } catch {
      // Failed to parse URL, fall through to default.
    }
  }

  return '';
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

      const remoteName =
        typeof args?.id === 'string' ? args.id.split('/')[0] : undefined;

      if (!remoteName || !processedRemotes[remoteName]) {
        return args;
      }

      const resolvedUrl = getResolvedRemoteUrl(processedRemotes[remoteName]);
      const remotes = getRemotes(args);

      const targetRemote = remotes.find(
        (remote) =>
          hasEntry(remote) &&
          (remote.name === remoteName || remote.alias === remoteName)
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
    const resolvedRemote =
      dependencies[remote.name] ?? dependencies[remote.alias ?? ''];
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

  const sessionEdgeURL = _window.sessionStorage?.getItem?.(
    resolvedRemote.application_uid
  );

  let edgeUrl = sessionEdgeURL ?? resolvedRemote.remote_entry_url;

  if (edgeUrl.indexOf('@') !== -1) {
    const [, url] = edgeUrl.split('@');
    edgeUrl = url;
  }

  return edgeUrl;
}
