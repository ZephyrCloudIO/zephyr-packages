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

type BeforeRequestArgs = Parameters<
  NonNullable<ModuleFederationRuntimePlugin['beforeRequest']>
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
  manifest_url?: string;
  library_type?: string;
}

interface ParsedManifest {
  vars: Record<string, string>;
  dependencies: Record<string, ManifestDependency>;
}

interface LoadedManifest extends ParsedManifest {
  persisted: boolean;
}

/** The application's own manifest, read from its Zephyr tag or environment alias. */
export interface NativeEnvRuntimeRoot {
  /** Module Federation name of the application's container. */
  name: string;
  /** Application UID its `ZE_PUBLIC_*` lookups are scoped by. */
  applicationUid: string;
  /** `zephyr-manifest.json` URL of the tag or environment alias. */
  manifestUrl: string;
}

interface NativeEnvState {
  /** Consumer-side remote name → application UID; `null` when ambiguous. */
  dependencyUids: Map<string, string | null>;
  /** Application UID → manifest URL its current values were loaded from. */
  loadedFrom: Map<string, string>;
  /** Session cache of manifest loads by absolute URL; failures are evicted. */
  manifests: Map<string, Promise<LoadedManifest | undefined>>;
  /** Container name → dependencies of the environment it was loaded from. */
  containerDependencies: Map<string, Record<string, ManifestDependency>>;
  /** Set by the application's own plugin when it reads a root manifest. */
  root?: NativeEnvRuntimeRoot;
  /** Settles once the persisted root manifest, if any, is applied. */
  rootApplied?: Promise<void>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNativeEnvState(value: unknown): value is NativeEnvState {
  return (
    isRecord(value) &&
    value['dependencyUids'] instanceof Map &&
    value['loadedFrom'] instanceof Map &&
    value['manifests'] instanceof Map &&
    value['containerDependencies'] instanceof Map
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
    containerDependencies: new Map(),
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

/** Same as the xpack runtime plugin: entries may carry a `name@` prefix. */
function stripRemoteNamePrefix(entry: string): string {
  if (/^(?:https?:)?\/\//.test(entry)) return entry;
  const absoluteUrlIndex = entry.search(/https?:\/\//);
  if (absoluteUrlIndex > 0) return entry.slice(absoluteUrlIndex);
  return entry.slice(entry.lastIndexOf('@') + 1);
}

function siblingManifestUrl(entry: string): string {
  const url = stripRemoteNamePrefix(entry).replace(/[?#].*$/, '');
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
      if (typeof applicationUid !== 'string') continue;
      const { remote_entry_url, manifest_url, library_type } = dependency;
      dependencies[name] = {
        application_uid: applicationUid,
        remote_entry_url:
          typeof remote_entry_url === 'string' ? remote_entry_url : undefined,
        manifest_url: typeof manifest_url === 'string' ? manifest_url : undefined,
        library_type: typeof library_type === 'string' ? library_type : undefined,
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
    state.containerDependencies.delete(remote.name);
  }

  const manifest = await fetchManifest(url);
  if (!manifest) {
    setApplicationEnv(uid, undefined);
    state.containerDependencies.delete(remote.name);
    return;
  }
  setApplicationEnv(uid, manifest.vars);
  // The container's own federation instance is created after this hook, so its
  // `beforeRequest` sees the remotes of the environment it was loaded from.
  state.containerDependencies.set(remote.name, manifest.dependencies);
  // Persisted values stand in until a later resolution reaches the network.
  if (!manifest.persisted) state.loadedFrom.set(uid, url);
  indexDependencies(state, manifest.dependencies);
  for (const dependency of Object.values(manifest.dependencies)) {
    const entry = dependency.manifest_url ?? dependency.remote_entry_url;
    const dependencyUrl = entry === undefined ? undefined : siblingManifestUrl(entry);
    if (isHttpUrl(dependencyUrl)) void fetchManifest(dependencyUrl);
  }
}

/**
 * Applies the root manifest persisted by the previous launch, then refreshes the stored
 * copy in the background. The refresh only applies on the next launch, so the remotes the
 * application loads never change mid-session. Without a persisted copy the build-time
 * remotes and values stay in place.
 */
async function applyRootManifest(
  state: NativeEnvState,
  root: NativeEnvRuntimeRoot
): Promise<void> {
  if (!envStorage()) {
    console.warn(
      `${LOG_PREFIX} ${root.manifestUrl}: zephyr-native-cache is not registered; keeping build-time remotes and values`
    );
    return;
  }
  const persisted = await readPersistedManifest(root.manifestUrl);
  if (persisted) {
    setApplicationEnv(root.applicationUid, persisted.vars);
    state.containerDependencies.set(root.name, persisted.dependencies);
    indexDependencies(state, persisted.dependencies);
  }
  void loadManifest(root.manifestUrl).then(
    (manifest) => persistManifest(root.manifestUrl, manifest),
    (error: unknown) => {
      const reason = error instanceof Error ? error.message : String(error);
      console.warn(`${LOG_PREFIX} ${root.manifestUrl}: ${reason}`);
    }
  );
}

function rootApplied(state: NativeEnvState, root: NativeEnvRuntimeRoot): Promise<void> {
  state.rootApplied ??= applyRootManifest(state, root).catch((error: unknown) => {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(`${LOG_PREFIX} ${root.manifestUrl}: ${reason}`);
  });
  return state.rootApplied;
}

/**
 * Points the requested remote at the deployment its container's environment lists, the
 * way the xpack runtime plugin does from the page's zephyr-manifest.json: environment
 * remote overrides replace the entries resolved at build time. The application's own
 * container reads them from its root manifest.
 */
async function beforeRequest(args: BeforeRequestArgs): Promise<BeforeRequestArgs> {
  const state = getNativeEnvState();
  if (state.root?.name === args.options.name) await rootApplied(state, state.root);
  const dependencies = state.containerDependencies.get(args.options.name);
  if (!dependencies) return args;
  const remote = args.options.remotes.find(
    (candidate) =>
      'entry' in candidate &&
      [candidate.alias, candidate.name].some(
        (key) => key !== undefined && (args.id === key || args.id.startsWith(`${key}/`))
      )
  );
  if (!remote || !('entry' in remote)) return args;
  // Manifest dependencies are keyed by the consumer-side name: the alias when set.
  const dependency =
    remote.alias !== undefined &&
    Object.prototype.hasOwnProperty.call(dependencies, remote.alias)
      ? dependencies[remote.alias]
      : dependencies[remote.name];
  const entry = dependency?.manifest_url ?? dependency?.remote_entry_url;
  if (entry === undefined) return args;
  const url = stripRemoteNamePrefix(entry);
  if (!isHttpUrl(url)) return args;
  remote.entry = url;
  if (url.replace(/[?#].*$/, '').endsWith('.json')) {
    // The snapshot plugin derives the entry type from the MF manifest.
    delete remote.type;
  } else if (dependency?.library_type !== undefined) {
    remote.type = dependency.library_type as typeof remote.type;
  }
  return args;
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
 * MF runtime plugin applying each resolved remote's Zephyr environment: its values from
 * the zephyr-manifest.json next to its entry, and the remote entries that environment
 * lists for the remotes it loads. `remoteUids` (remote name → application UID) seeds the
 * lookup; loaded manifests add nested remotes. `root` applies the application's own tag
 * or environment manifest, as persisted by the previous launch, to its remotes and
 * values.
 */
export function createNativeEnvRuntimePlugin(
  remoteUids: Readonly<Record<string, string>>,
  root?: NativeEnvRuntimeRoot
): ModuleFederationRuntimePlugin {
  const state = getNativeEnvState();
  if (root) state.root = root;
  indexDependencies(
    state,
    Object.fromEntries(
      Object.entries(remoteUids).map(([name, uid]) => [name, { application_uid: uid }])
    )
  );
  return {
    name: PLUGIN_NAME,
    afterResolve,
    beforeRequest,
    beforeInit(args: BeforeInitArgs) {
      const federation = globalThis.__FEDERATION__;
      if (federation) {
        federation.__GLOBAL_PLUGIN__ ??= [];
        if (!federation.__GLOBAL_PLUGIN__.some((plugin) => plugin.name === PLUGIN_NAME)) {
          federation.__GLOBAL_PLUGIN__.push({
            name: PLUGIN_NAME,
            afterResolve,
            beforeRequest,
          });
        }
      }
      return args;
    },
  };
}
