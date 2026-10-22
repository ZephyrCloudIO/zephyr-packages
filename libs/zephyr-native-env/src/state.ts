import type { ZephyrRuntimeNamespace } from 'zephyr-edge-contract';

// This module may be bundled into the host and into every remote, so all state
// lives on `globalThis.__ZEPHYR__` instead of module scope.

const ZEPHYR_GLOBAL_VERSION = 1 as const;
const STATE_KEY = 'zephyr-native-env';
const PUBLIC_KEY = /^ZE_PUBLIC_[A-Z0-9_]+$/;
const HTTP_URL = /^https?:\/\//;
const STORAGE_PREFIX = 'zephyr-native-env:';

export const DEFAULT_TIMEOUT_MS = 3000;

export interface ManifestDependency {
  application_uid: string;
  remote_entry_url?: string;
}

export interface ParsedManifest {
  vars: Record<string, string>;
  dependencies: Record<string, ManifestDependency>;
}

/** AsyncStorage-compatible store; MMKV and similar stores need a thin wrapper. */
export interface ZephyrEnvStorage {
  getItem(key: string): Promise<string | null> | string | null;
  setItem(key: string, value: string): Promise<void> | void;
}

export interface NativeEnvState {
  timeoutMs: number;
  hostReady?: Promise<void>;
  /** Consumer-side remote name → application UID; `null` when ambiguous. */
  dependencyUids: Map<string, string | null>;
  /** Application UID → manifest URL its current values were loaded from. */
  loadedFrom: Map<string, string>;
  /** Session cache of manifest loads by absolute URL; failures are evicted. */
  manifests: Map<string, Promise<ParsedManifest | undefined>>;
  /** Store for the last loaded values per manifest URL, used when a load fails. */
  storage?: ZephyrEnvStorage;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNativeEnvState(value: unknown): value is NativeEnvState {
  return (
    isRecord(value) &&
    typeof value['timeoutMs'] === 'number' &&
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

export function getNativeEnvState(): NativeEnvState {
  const runtime = ensureRuntimeNamespace();
  const existing = runtime[STATE_KEY];
  if (isNativeEnvState(existing)) return existing;
  const state: NativeEnvState = {
    timeoutMs: DEFAULT_TIMEOUT_MS,
    dependencyUids: new Map(),
    loadedFrom: new Map(),
    manifests: new Map(),
  };
  runtime[STATE_KEY] = state;
  return state;
}

/**
 * Replaces (or, with `undefined`, removes) the values compiled code reads for an
 * application. Copy-on-write keeps previously published objects intact.
 */
export function setApplicationEnv(
  applicationUid: string,
  vars: Record<string, string> | undefined
): void {
  const runtime = ensureRuntimeNamespace();
  const next = { ...runtime.env };
  if (vars) {
    next[applicationUid] = Object.freeze({ ...vars });
  } else {
    delete next[applicationUid];
  }
  runtime.env = next;
}

export function isHttpUrl(value: unknown): value is string {
  return typeof value === 'string' && HTTP_URL.test(value);
}

/**
 * `zephyr-manifest.json` URL next to a remote entry (`[name@]http…/file[?…][#…]`). String
 * operations only: React Native's `URL` polyfill does not resolve paths.
 */
export function siblingManifestUrl(entry: string): string {
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

async function loadManifest(url: string, timeoutMs: number): Promise<ParsedManifest> {
  const controller =
    typeof AbortController === 'function' ? new AbortController() : undefined;
  let cancelTimeout = (): void => undefined;
  // Race the timer as well as aborting: not every fetch implementation honours signals.
  const timeout = new Promise<never>((_, reject) => {
    const timer = setTimeout(() => {
      controller?.abort();
      reject(new Error(`timed out after ${timeoutMs}ms`));
    }, timeoutMs);
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

async function persistManifest(
  storage: ZephyrEnvStorage | undefined,
  url: string,
  manifest: ParsedManifest
): Promise<void> {
  if (!storage) return;
  try {
    await storage.setItem(
      STORAGE_PREFIX + url,
      JSON.stringify({ zeVars: manifest.vars, dependencies: manifest.dependencies })
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(`[zephyr-native-env] ${url}: cannot persist values: ${reason}`);
  }
}

async function readPersistedManifest(
  storage: ZephyrEnvStorage | undefined,
  url: string
): Promise<ParsedManifest | undefined> {
  if (!storage) return undefined;
  try {
    const raw = await storage.getItem(STORAGE_PREFIX + url);
    if (raw === null || raw === undefined) return undefined;
    // Re-parse so persisted data passes the same key and type checks as fetched data.
    return parseManifest(JSON.parse(raw));
  } catch {
    console.warn(`[zephyr-native-env] ${url}: ignoring unreadable persisted values`);
    return undefined;
  }
}

/**
 * Loads a manifest once per URL for the session and persists it to `state.storage`. On
 * failure it warns, evicts the entry so a later call retries, and resolves the last
 * values persisted for that URL, or `undefined` without any.
 */
export function fetchManifest(url: string): Promise<ParsedManifest | undefined> {
  const state = getNativeEnvState();
  const cached = state.manifests.get(url);
  if (cached) return cached;

  const pending = loadManifest(url, state.timeoutMs).then(
    (manifest) => {
      // Persisting must not delay startup.
      void persistManifest(state.storage, url, manifest);
      return manifest;
    },
    async (error: unknown) => {
      state.manifests.delete(url);
      const reason = error instanceof Error ? error.message : String(error);
      console.warn(`[zephyr-native-env] ${url}: ${reason}`);
      const lastKnown = await readPersistedManifest(state.storage, url);
      if (lastKnown) console.warn(`[zephyr-native-env] ${url}: using last known values`);
      return lastKnown;
    }
  );
  state.manifests.set(url, pending);
  return pending;
}

/** Records remote name → UID; a name seen with two different UIDs is skipped later. */
export function indexDependencies(
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
        `[zephyr-native-env] remote "${name}" maps to several applications; it keeps build-time values`
      );
    }
  }
}
