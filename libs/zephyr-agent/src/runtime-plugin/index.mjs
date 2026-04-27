// @ts-check

/** @typedef {import('zephyr-edge-contract').ZephyrDependency} ZephyrDependency */
/** @typedef {import('zephyr-edge-contract').ZephyrManifest} ZephyrManifest */
/** @typedef {import('./module-federation.types').BeforeRequestHookArgs} BeforeRequestHookArgs */
/** @typedef {import('./module-federation.types').FederationRuntimePlugin} FederationRuntimePlugin */
/** @typedef {import('./module-federation.types').RemoteWithEntry} RemoteWithEntry */

/**
 * @typedef ZephyrRuntimePluginOptions
 * @property {string} [manifestUrl]
 */

const globalCacheKey = '__ZEPHYR_MANIFEST_CACHE__';
const _global = /** @type {Window & typeof globalThis} */ (
  typeof window !== 'undefined' ? window : globalThis
);

/** @returns {Map<string, Promise<ZephyrManifest | undefined>>} */
function getGlobalManifestCache() {
  if (!_global[globalCacheKey]) {
    _global[globalCacheKey] = new Map();
  }
  return _global[globalCacheKey];
}

/** @returns {string} */
function getScriptBaseUrl() {
  if (typeof document !== 'undefined' && document.currentScript) {
    try {
      const script =
        document.currentScript instanceof HTMLScriptElement
          ? document.currentScript
          : null;
      const src = script?.src;
      if (src) {
        const url = new URL(src);
        return `${url.protocol}//${url.host}`;
      }
    } catch {
      // ignore invalid URL
    }
  }

  return '';
}

/**
 * @param {ZephyrRuntimePluginOptions} [options]
 * @returns {FederationRuntimePlugin}
 */
export function createZephyrRuntimePlugin(options = {}) {
  const defaultManifestUrl = `${getScriptBaseUrl()}/zephyr-manifest.json`;
  const { manifestUrl = defaultManifestUrl } = options;

  let processedRemotes;

  /** @param {string} url */
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

      const remoteName = args.id.split('/')[0];

      if (!processedRemotes[remoteName]) {
        return args;
      }

      const resolvedUrl = getResolvedRemoteUrl(processedRemotes[remoteName]);

      const targetRemote = args.options.remotes.find(
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

/**
 * @param {BeforeRequestHookArgs} args
 * @param {ZephyrManifest | undefined} zephyrManifest
 * @returns {Record<string, ZephyrDependency>}
 */
function identifyRemotes(args, zephyrManifest) {
  /** @type {Record<string, ZephyrDependency>} */
  const identifiedRemotes = {};

  if (!zephyrManifest || !args.options.remotes.length) {
    return identifiedRemotes;
  }

  const { dependencies } = zephyrManifest;

  args.options.remotes.forEach((remote) => {
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

/**
 * @param {unknown} remote
 * @returns {remote is RemoteWithEntry}
 */
function hasEntry(remote) {
  return (
    remote !== null &&
    remote !== undefined &&
    typeof remote === 'object' &&
    'entry' in remote &&
    typeof remote.entry === 'string'
  );
}

/**
 * @param {ZephyrDependency} resolvedRemote
 * @returns {string}
 */
function getResolvedRemoteUrl(resolvedRemote) {
  const _window = typeof window !== 'undefined' ? window : globalThis;
  const sessionEdgeURL = _window.sessionStorage?.getItem(
    resolvedRemote.application_uid
  );

  let edgeUrl = sessionEdgeURL ?? resolvedRemote.remote_entry_url;

  if (edgeUrl.indexOf('@') !== -1) {
    const [, url] = edgeUrl.split('@');
    edgeUrl = url;
  }

  return edgeUrl;
}

export default createZephyrRuntimePlugin;
