import type { ModuleFederationRuntimePlugin } from '@module-federation/runtime';
import type {
  ZephyrNativeEnvStorage,
  ZephyrRuntimeNamespace,
} from 'zephyr-edge-contract';

// Metro and Re.Pack bundle this file from an absolute path into the host and every
// remote: it must import only types, and all state lives on `globalThis.__ZEPHYR__`.

type AfterResolveArgs = Parameters<
  NonNullable<ModuleFederationRuntimePlugin['afterResolve']>
>[0];

type BeforeInitArgs = Parameters<
  NonNullable<ModuleFederationRuntimePlugin['beforeInit']>
>[0];

const ZEPHYR_GLOBAL_VERSION = 1 as const;
const PUBLIC_KEY = /^ZE_PUBLIC_[A-Z0-9_]+$/;
const HTTP_URL = /^https?:\/\//;
const MANIFEST_TIMEOUT_MS = 3000;
const LOG_PREFIX = '[zephyr-env]';
const PLUGIN_NAME = 'zephyr-env-plugin';
const STATE_KEY = 'nativeEnv';

interface ManifestDependency {
  application_uid: string;
  remote_entry_url?: string;
}

interface ParsedManifest {
  vars: Record<string, string>;
  dependencies: Record<string, ManifestDependency>;
}

interface LoadedManifest extends ParsedManifest {
  persisted: boolean;
}

interface NativeEnvState {
  /** Consumer-side remote name → application UID; `null` when ambiguous. */
  dependencyUids: Map<string, string | null>;
  /** Application UID → manifest URL its current values were loaded from. */
  loadedFrom: Map<string, string>;
  /** Session cache of manifest loads by absolute URL; failures are evicted. */
  manifests: Map<string, Promise<LoadedManifest | undefined>>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNativeEnvState(value: unknown): value is NativeEnvState {
  return (
    isRecord(value) &&
    value['dependencyUids'] instanceof Map &&
    value['loadedFrom'] instanceof Map &&
    value['manifests'] instanceof Map
  );
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

function getNativeEnvState(): NativeEnvState {
  const runtime = ensureRuntimeNamespace();
  const existing = runtime[STATE_KEY];
  if (isNativeEnvState(existing)) return existing;
  const state: NativeEnvState = {
    dependencyUids: new Map(),
    loadedFrom: new Map(),
    manifests: new Map(),
  };
  runtime[STATE_KEY] = state;
  return state;
}

function setApplicationEnv(uid: string, vars: Record<string, string> | undefined): void {
  const runtime = ensureRuntimeNamespace();
  const next = { ...runtime.env };
  if (vars) {
    next[uid] = Object.freeze({ ...vars });
  } else {
    delete next[uid];
  }
  runtime.env = next;
}

/** Read on every call: native-cache `register()` may run after the plugin is created. */
function envStorage(): ZephyrNativeEnvStorage | undefined {
  const storage = globalThis.__ZEPHYR__?.runtime?.nativeCache?.refs?.envStorage;
  return typeof storage?.getItem === 'function' && typeof storage.setItem === 'function'
    ? storage
    : undefined;
}

function isHttpUrl(value: unknown): value is string {
  return typeof value === 'string' && HTTP_URL.test(value);
}

function siblingManifestUrl(entry: string): string {
  let url = entry;
  const nameSeparator = url.indexOf('@http');
  if (!HTTP_URL.test(url) && nameSeparator > 0) {
    url = url.slice(nameSeparator + 1);
  }
  url = url.replace(/[?#].*$/, '');
  return `${url.slice(0, url.lastIndexOf('/') + 1)}zephyr-manifest.json`;
}

function parseManifest(json: unknown): ParsedManifest {
  if (!isRecord(json)) throw new Error('manifest is not a JSON object');
  const vars: Record<string, string> = {};
  const zeVars = json['zeVars'];
  if (isRecord(zeVars)) {
    for (const [key, value] of Object.entries(zeVars)) {
      if (typeof value === 'string' && PUBLIC_KEY.test(key)) vars[key] = value;
    }
  }
  const dependencies: Record<string, ManifestDependency> = {};
  const rawDependencies = json['dependencies'];
  if (isRecord(rawDependencies)) {
    for (const [name, dependency] of Object.entries(rawDependencies)) {
      if (!isRecord(dependency)) continue;
      const applicationUid = dependency['application_uid'];
      const remoteEntryUrl = dependency['remote_entry_url'];
      if (typeof applicationUid !== 'string') continue;
      dependencies[name] = {
        application_uid: applicationUid,
        remote_entry_url: typeof remoteEntryUrl === 'string' ? remoteEntryUrl : undefined,
      };
    }
  }
  return { vars, dependencies };
}

async function loadManifest(url: string): Promise<ParsedManifest> {
  const controller =
    typeof AbortController === 'function' ? new AbortController() : undefined;
  let cancelTimeout = (): void => undefined;
  const timeout = new Promise<never>((_, reject) => {
    const timer = setTimeout(() => {
      controller?.abort();
      reject(new Error(`timed out after ${MANIFEST_TIMEOUT_MS}ms`));
    }, MANIFEST_TIMEOUT_MS);
    cancelTimeout = () => clearTimeout(timer);
  });
  const request = (async () => {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller?.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return parseManifest(await response.json());
  })();
  try {
    return await Promise.race([request, timeout]);
  } finally {
    cancelTimeout();
  }
}

async function persistManifest(url: string, manifest: ParsedManifest): Promise<void> {
  const storage = envStorage();
  if (!storage) return;
  try {
    await storage.setItem(
      url,
      JSON.stringify({ zeVars: manifest.vars, dependencies: manifest.dependencies })
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(`${LOG_PREFIX} ${url}: cannot persist values: ${reason}`);
  }
}

async function readPersistedManifest(url: string): Promise<ParsedManifest | undefined> {
  const storage = envStorage();
  if (!storage) return undefined;
  try {
    const raw = await storage.getItem(url);
    if (raw === undefined) return undefined;
    return parseManifest(JSON.parse(raw));
  } catch {
    console.warn(`${LOG_PREFIX} ${url}: ignoring unreadable persisted values`);
    return undefined;
  }
}

function fetchManifest(url: string): Promise<LoadedManifest | undefined> {
  const state = getNativeEnvState();
  const cached = state.manifests.get(url);
  if (cached) return cached;

  const pending: Promise<LoadedManifest | undefined> = loadManifest(url).then(
    (manifest) => {
      void persistManifest(url, manifest);
      return { ...manifest, persisted: false };
    },
    async (error: unknown) => {
      try {
        const reason = error instanceof Error ? error.message : String(error);
        console.warn(`${LOG_PREFIX} ${url}: ${reason}`);
        const lastKnown = await readPersistedManifest(url);
        if (!lastKnown) return undefined;
        console.warn(`${LOG_PREFIX} ${url}: using last known values`);
        return { ...lastKnown, persisted: true };
      } finally {
        // Evict only once the fallback settles: concurrent resolutions share it instead
        // of racing a newer fetch that the older fallback would then overwrite.
        if (state.manifests.get(url) === pending) state.manifests.delete(url);
      }
    }
  );
  state.manifests.set(url, pending);
  return pending;
}

function indexDependencies(
  state: NativeEnvState,
  dependencies: Record<string, ManifestDependency>
): void {
  for (const [name, { application_uid }] of Object.entries(dependencies)) {
    const known = state.dependencyUids.get(name);
    if (known === undefined) {
      state.dependencyUids.set(name, application_uid);
    } else if (known !== null && known !== application_uid) {
      state.dependencyUids.set(name, null);
      console.warn(
        `${LOG_PREFIX} remote "${name}" maps to several applications; it keeps build-time values`
      );
    }
  }
}

async function loadRemoteEnv(remote: {
  name: string;
  alias?: string;
  entry?: string;
}): Promise<void> {
  const state = getNativeEnvState();
  // Manifest dependencies are keyed by the consumer-side name: the alias when set.
  const uid =
    remote.alias !== undefined && state.dependencyUids.has(remote.alias)
      ? state.dependencyUids.get(remote.alias)
      : state.dependencyUids.get(remote.name);
  if (typeof uid !== 'string' || typeof remote.entry !== 'string') return;

  const url = siblingManifestUrl(remote.entry);
  if (!isHttpUrl(url)) return;
  const loadedFrom = state.loadedFrom.get(uid);
  if (loadedFrom === url) return;
  if (loadedFrom !== undefined) {
    // Never reuse another environment's values for a remote loaded from a new root.
    setApplicationEnv(uid, undefined);
    state.loadedFrom.delete(uid);
  }

  const manifest = await fetchManifest(url);
  if (!manifest) {
    setApplicationEnv(uid, undefined);
    return;
  }
  setApplicationEnv(uid, manifest.vars);
  // Persisted values stand in until a later resolution reaches the network.
  if (!manifest.persisted) state.loadedFrom.set(uid, url);
  indexDependencies(state, manifest.dependencies);
  for (const dependency of Object.values(manifest.dependencies)) {
    if (isHttpUrl(dependency.remote_entry_url)) {
      void fetchManifest(siblingManifestUrl(dependency.remote_entry_url));
    }
  }
}

async function afterResolve(args: AfterResolveArgs): Promise<AfterResolveArgs> {
  try {
    await loadRemoteEnv(args.remote as { name: string; alias?: string; entry?: string });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(`${LOG_PREFIX} ${args.remote.name}: ${reason}`);
  }
  return args;
}

/**
 * MF runtime plugin applying each resolved remote's Zephyr environment values from the
 * zephyr-manifest.json next to its entry. `remoteUids` (remote name → application UID)
 * seeds the lookup; loaded manifests add nested remotes.
 */
export function createNativeEnvRuntimePlugin(
  remoteUids: Readonly<Record<string, string>>
): ModuleFederationRuntimePlugin {
  indexDependencies(
    getNativeEnvState(),
    Object.fromEntries(
      Object.entries(remoteUids).map(([name, uid]) => [name, { application_uid: uid }])
    )
  );
  return {
    name: PLUGIN_NAME,
    afterResolve,
    beforeInit(args: BeforeInitArgs) {
      const federation = globalThis.__FEDERATION__;
      if (federation) {
        federation.__GLOBAL_PLUGIN__ ??= [];
        if (!federation.__GLOBAL_PLUGIN__.some((plugin) => plugin.name === PLUGIN_NAME)) {
          federation.__GLOBAL_PLUGIN__.push({ name: PLUGIN_NAME, afterResolve });
        }
      }
      return args;
    },
  };
}
