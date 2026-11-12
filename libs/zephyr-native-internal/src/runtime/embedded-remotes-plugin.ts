import type { ModuleFederationRuntimePlugin } from '@module-federation/runtime';
import type { ZephyrNativeCacheRefs, ZephyrRuntimeNamespace } from 'zephyr-edge-contract';
import type { EmbeddedRemoteRuntime } from '../lib/embed-remotes';

// The host bundles this file from an absolute path: it must import only types. The host
// evaluates it once, so its state is module-scoped.

type ErrorLoadRemoteArgs = Parameters<
  NonNullable<ModuleFederationRuntimePlugin['errorLoadRemote']>
>[0];

type LoadRemoteSnapshotArgs = Parameters<
  NonNullable<ModuleFederationRuntimePlugin['loadRemoteSnapshot']>
>[0];

type BeforeInitArgs = Parameters<
  NonNullable<ModuleFederationRuntimePlugin['beforeInit']>
>[0];

type Locator = { url: string } & Record<string, unknown>;

/** Re.Pack ScriptManager `load` tap: it loads the script itself and returns true. */
export type RepackLoadHook = (args: {
  options: { scriptId: string; caller?: string };
  script: { locator: Locator };
  loadScript: (scriptId?: string, locator?: Record<string, unknown>) => Promise<void>;
}) => Promise<boolean>;

/** The part of Re.Pack's ScriptManager (5.1+) this plugin uses. */
export interface RepackScriptManager {
  hooks: { load(fn: RepackLoadHook): void };
}

export interface EmbeddedRemotesOptions {
  bundler: 'metro' | 'repack';
  /** Re.Pack only: the app's `ScriptManager.shared`. */
  getScriptManager?: () => RepackScriptManager;
}

interface ManifestShape {
  metaData?: {
    publicPath?: unknown;
    getPublicPath?: unknown;
    buildInfo?: { hash?: unknown };
    remoteEntry?: { name?: unknown; path?: unknown };
  };
}

const ZEPHYR_GLOBAL_VERSION = 1 as const;
const EMBEDDED_ORIGIN = 'https://zephyr-embedded.invalid/';
const LOG_PREFIX = '[zephyr-embed]';
const PLUGIN_NAME = 'zephyr-embedded-remotes-plugin';
const MANIFEST_KEY_PREFIX = 'mf-manifest:';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Mirrors zephyr-native-cache's namespace setup so `runtime.nativeCache` is kept. */
function ensureRuntimeNamespace(): ZephyrRuntimeNamespace {
  if (!isRecord(globalThis.__ZEPHYR__)) {
    globalThis.__ZEPHYR__ = { version: ZEPHYR_GLOBAL_VERSION, runtime: {} };
  }
  const zephyrGlobal = globalThis.__ZEPHYR__;
  zephyrGlobal.version = ZEPHYR_GLOBAL_VERSION;
  if (!isRecord(zephyrGlobal.runtime)) {
    zephyrGlobal.runtime = {};
  }
  if (typeof window !== 'undefined') {
    window.__ZEPHYR__ = zephyrGlobal;
  }
  return zephyrGlobal.runtime;
}

/** Read on every call: native-cache `register()` may run after the plugin is created. */
function nativeCacheRefs(): ZephyrNativeCacheRefs | undefined {
  return globalThis.__ZEPHYR__?.runtime?.nativeCache?.refs;
}

function stripQuery(url: string): string {
  return url.replace(/[?#].*$/, '');
}

function basenameOf(url: string): string {
  const bare = stripQuery(url);
  return bare.slice(bare.lastIndexOf('/') + 1);
}

/** Container URL of a manifest, by the base-URL rule the build used to download it. */
function containerUrl(manifest: ManifestShape, manifestUrl: string): string {
  const metaData = manifest.metaData ?? {};
  const publicPath = metaData.publicPath;
  const base =
    typeof publicPath === 'string' && /^https?:\/\//.test(publicPath)
      ? publicPath.replace(/\/*$/, '/')
      : stripQuery(manifestUrl).replace(/[^/]*$/, '');
  const entryPath = metaData.remoteEntry?.path;
  const entryName = metaData.remoteEntry?.name;
  return `${base}${typeof entryPath === 'string' && entryPath ? `${entryPath}/` : ''}${String(entryName)}`;
}

function warnEmbedded(name: string): void {
  console.warn(
    `${LOG_PREFIX} ${name}: network unavailable; using the copy embedded in the app`
  );
}

/**
 * MF runtime plugin that serves the remotes embedded in the app (`embedRemotes`) when
 * neither the cache nor the network can. Metro: a failed manifest load falls back to the
 * last manifest loaded online when its bundles are cached, then to the embedded manifest,
 * whose bundle URLs zephyr-native-cache hands to `__ZEPHYR__.runtime.embeddedRemotes`.
 * Re.Pack: a ScriptManager `load` hook loads the embedded files once a remote falls
 * back.
 */
export function createEmbeddedRemotesPlugin(
  remotes: EmbeddedRemoteRuntime[],
  options: EmbeddedRemotesOptions
): ModuleFederationRuntimePlugin {
  const byName = new Map(remotes.map((remote) => [remote.name, remote]));
  /** Remote names now served from the embedded copy. */
  const embeddedMode = new Set<string>();
  /** Manifest URLs answered from a fallback; they are not persisted. */
  const recovered = new Set<string>();
  let hookInstalled = false;

  function findRemote(name: unknown): EmbeddedRemoteRuntime | undefined {
    if (typeof name !== 'string') return undefined;
    return byName.get(name) ?? remotes.find((remote) => remote.globalName === name);
  }

  ensureRuntimeNamespace().embeddedRemotes = {
    owns: (bundleUrl) => bundleUrl.startsWith(EMBEDDED_ORIGIN),
    async load(bundleUrl) {
      const remainder = stripQuery(bundleUrl.slice(EMBEDDED_ORIGIN.length));
      const slash = remainder.indexOf('/');
      const name = decodeURIComponent(slash < 0 ? remainder : remainder.slice(0, slash));
      const relativePath = slash < 0 ? '' : remainder.slice(slash + 1);
      const flat = byName.get(name)?.files[relativePath];
      if (flat === undefined) {
        throw new Error(
          `${LOG_PREFIX} ${name}: ${relativePath} is not embedded in the app`
        );
      }
      const refs = nativeCacheRefs();
      const text = await refs?.readBundledFile?.(flat);
      if (text === undefined) {
        throw new Error(`${LOG_PREFIX} ${name}: ${flat} is missing from the app binary`);
      }
      if (typeof globalThis.globalEvalWithSourceUrl === 'function') {
        globalThis.globalEvalWithSourceUrl(text, bundleUrl);
      } else {
        // eslint-disable-next-line no-eval
        (0, eval)(text);
      }
      refs?.recordEmbeddedLoad?.(bundleUrl, name);
    },
  };

  function embeddedManifest(remote: EmbeddedRemoteRuntime, manifestUrl: string): unknown {
    const copy = JSON.parse(JSON.stringify(remote.manifest)) as ManifestShape;
    if (options.bundler === 'metro' && copy.metaData) {
      copy.metaData.publicPath = `${EMBEDDED_ORIGIN}${encodeURIComponent(remote.name)}/`;
      delete copy.metaData.getPublicPath;
    }
    recovered.add(manifestUrl);
    embeddedMode.add(remote.name);
    warnEmbedded(remote.name);
    return copy;
  }

  async function metroFallback(
    remote: EmbeddedRemoteRuntime,
    manifestUrl: string
  ): Promise<unknown> {
    const refs = nativeCacheRefs();
    const federationNative = (
      globalThis.__FEDERATION__ as { __NATIVE__?: { __CACHE__?: unknown } } | undefined
    )?.__NATIVE__;
    if (
      typeof refs?.readBundledFile !== 'function' ||
      typeof federationNative?.__CACHE__ !== 'function'
    ) {
      console.warn(
        `${LOG_PREFIX} ${remote.name}: zephyr-native-cache is not registered, so the copy embedded in the app cannot load. Install zephyr-native-cache and call ZephyrNativeCache.register() at startup.`
      );
      return undefined;
    }

    let persisted: ManifestShape | undefined;
    try {
      const raw = await refs.envStorage?.getItem(`${MANIFEST_KEY_PREFIX}${manifestUrl}`);
      const parsed: unknown = raw === undefined ? undefined : JSON.parse(raw);
      persisted = isRecord(parsed) ? (parsed as ManifestShape) : undefined;
    } catch {
      persisted = undefined;
    }
    if (persisted) {
      const hash = persisted.metaData?.buildInfo?.hash;
      const cached = await refs
        .hasCachedBundle?.(
          containerUrl(persisted, manifestUrl),
          typeof hash === 'string' ? hash : undefined
        )
        .catch(() => false);
      if (cached) {
        recovered.add(manifestUrl);
        console.warn(
          `${LOG_PREFIX} ${remote.name}: network unavailable; using the cached version`
        );
        return persisted;
      }
    }
    return embeddedManifest(remote, manifestUrl);
  }

  function installRepackHook(): void {
    if (hookInstalled) return;
    hookInstalled = true;
    let scriptManager: RepackScriptManager | undefined;
    try {
      scriptManager = options.getScriptManager?.();
    } catch {
      scriptManager = undefined;
    }
    if (typeof scriptManager?.hooks?.load !== 'function') {
      console.warn(
        `${LOG_PREFIX} Re.Pack ScriptManager hooks are unavailable (Re.Pack 5.1+ required); embedded remotes are disabled`
      );
      return;
    }

    // Re.Pack skips its default loader whenever a `load` tap exists: always load.
    scriptManager.hooks.load(async ({ options: load, script, loadScript }) => {
      const remote = remotes.find((candidate) =>
        load.caller === undefined
          ? load.scriptId === candidate.globalName
          : load.caller === candidate.name || load.caller === candidate.globalName
      );
      const basename = basenameOf(script.locator.url);
      const flat =
        remote &&
        Object.entries(remote.files).find(
          ([relativePath]) => basenameOf(relativePath) === basename
        )?.[1];
      if (!remote || flat === undefined) {
        await loadScript();
        return true;
      }

      const local = {
        ...script.locator,
        url: `file:///${flat}`,
        absolute: false,
        query: undefined,
        headers: undefined,
        body: undefined,
      };
      if (!embeddedMode.has(remote.name)) {
        try {
          await loadScript();
          return true;
        } catch (error) {
          // Only a container switches a remote to its embedded copy: a chunk of a remote
          // loaded from the network must not mix in embedded files.
          if (load.caller !== undefined) throw error;
          embeddedMode.add(remote.name);
          warnEmbedded(remote.name);
        }
      }
      await loadScript(load.scriptId, local);
      nativeCacheRefs()?.recordEmbeddedLoad?.(script.locator.url, remote.name);
      return true;
    });
  }

  const plugin: ModuleFederationRuntimePlugin = {
    name: PLUGIN_NAME,
    async errorLoadRemote(args: ErrorLoadRemoteArgs) {
      if (
        args.lifecycle !== 'afterResolve' ||
        args.from !== 'runtime' ||
        typeof args.id !== 'string'
      ) {
        return undefined;
      }
      const remote = findRemote(args.remote?.name);
      if (!remote) return undefined;
      return options.bundler === 'metro'
        ? metroFallback(remote, args.id)
        : embeddedManifest(remote, args.id);
    },
  };

  if (options.bundler === 'metro') {
    plugin.loadRemoteSnapshot = (args: LoadRemoteSnapshotArgs) => {
      const url = args.manifestUrl;
      const storage = nativeCacheRefs()?.envStorage;
      if (
        args.from === 'manifest' &&
        url !== undefined &&
        findRemote(args.moduleInfo.name) &&
        !recovered.has(url) &&
        typeof storage?.setItem === 'function'
      ) {
        storage
          .setItem(`${MANIFEST_KEY_PREFIX}${url}`, JSON.stringify(args.manifestJson))
          .catch((error: unknown) => {
            const reason = error instanceof Error ? error.message : String(error);
            console.warn(`${LOG_PREFIX} ${url}: cannot persist manifest: ${reason}`);
          });
      }
      return args;
    };
  } else {
    plugin.beforeInit = (args: BeforeInitArgs) => {
      installRepackHook();
      return args;
    };
  }

  return plugin;
}
