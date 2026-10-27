import type { ZephyrNativeCacheRefs } from 'zephyr-edge-contract';
import NativeMFECache from './NativeMFECache';
import {
  ensureZephyrGlobalNamespace,
  ensureZephyrNativeCacheRefs,
} from './zephyr-global';

const PUBLIC_KEY = /^ZE_PUBLIC_[A-Z0-9_]+$/;
const HTTP_URL = /^https?:\/\//;
const MANIFEST_TIMEOUT_MS = 3000;
const LOG_PREFIX = '[MFE-Cache]';
const STATE_KEY = 'env';

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

function getNativeEnvState(): NativeEnvState {
  const refs: ZephyrNativeCacheRefs = ensureZephyrNativeCacheRefs();
  const existing = refs[STATE_KEY];
  if (isNativeEnvState(existing)) return existing;
  const state: NativeEnvState = {
    dependencyUids: new Map(),
    loadedFrom: new Map(),
    manifests: new Map(),
  };
  refs[STATE_KEY] = state;
  return state;
}

function setApplicationEnv(uid: string, vars: Record<string, string> | undefined): void {
  const runtime = ensureZephyrGlobalNamespace().runtime;
  const next = { ...runtime.env };
  if (vars) {
    next[uid] = Object.freeze({ ...vars });
  } else {
    delete next[uid];
  }
  runtime.env = next;
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

async function persistedManifestPath(url: string): Promise<string> {
  const nativeCache = NativeMFECache;
  if (!nativeCache) throw new Error('native cache file module is unavailable');
  return `${await nativeCache.getDocumentDirectory()}/zephyr-env-${await nativeCache.sha256String(url)}.json`;
}

async function persistManifest(url: string, manifest: ParsedManifest): Promise<void> {
  if (!NativeMFECache) return;
  try {
    const path = await persistedManifestPath(url);
    await NativeMFECache.writeFile(
      path,
      JSON.stringify({ zeVars: manifest.vars, dependencies: manifest.dependencies }),
      'utf8'
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(`${LOG_PREFIX} env ${url}: cannot persist values: ${reason}`);
  }
}

async function readPersistedManifest(url: string): Promise<ParsedManifest | undefined> {
  if (!NativeMFECache) return undefined;
  try {
    const path = await persistedManifestPath(url);
    if (!(await NativeMFECache.fileExists(path))) return undefined;
    return parseManifest(JSON.parse(await NativeMFECache.readFile(path, 'utf8')));
  } catch {
    console.warn(`${LOG_PREFIX} env ${url}: ignoring unreadable persisted values`);
    return undefined;
  }
}

function fetchManifest(url: string): Promise<LoadedManifest | undefined> {
  const state = getNativeEnvState();
  const cached = state.manifests.get(url);
  if (cached) return cached;

  const pending = loadManifest(url).then(
    (manifest) => {
      void persistManifest(url, manifest);
      return { ...manifest, persisted: false };
    },
    async (error: unknown) => {
      state.manifests.delete(url);
      const reason = error instanceof Error ? error.message : String(error);
      console.warn(`${LOG_PREFIX} env ${url}: ${reason}`);
      const lastKnown = await readPersistedManifest(url);
      if (!lastKnown) return undefined;
      console.warn(`${LOG_PREFIX} env ${url}: using last known values`);
      return { ...lastKnown, persisted: true };
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
        `${LOG_PREFIX} env remote "${name}" maps to several applications; it keeps build-time values`
      );
    }
  }
}

export async function loadRemoteEnv(remote: {
  name: string;
  alias?: string;
  entry?: string;
}): Promise<void> {
  const state = getNativeEnvState();
  const seed = globalThis.__ZEPHYR__?.runtime?.remoteApplicationUids;
  if (isRecord(seed)) {
    const dependencies: Record<string, ManifestDependency> = {};
    for (const [name, uid] of Object.entries(seed)) {
      if (typeof uid === 'string') dependencies[name] = { application_uid: uid };
    }
    indexDependencies(state, dependencies);
  }

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
    setApplicationEnv(uid, undefined);
    state.loadedFrom.delete(uid);
  }

  const manifest = await fetchManifest(url);
  if (!manifest) {
    setApplicationEnv(uid, undefined);
    return;
  }
  setApplicationEnv(uid, manifest.vars);
  if (!manifest.persisted) state.loadedFrom.set(uid, url);
  indexDependencies(state, manifest.dependencies);
  for (const dependency of Object.values(manifest.dependencies)) {
    if (isHttpUrl(dependency.remote_entry_url)) {
      void fetchManifest(siblingManifestUrl(dependency.remote_entry_url));
    }
  }
}
