import type {
  ZephyrGlobalNamespace,
  ZephyrNativeCacheControls,
  ZephyrNativeCacheNamespace,
  ZephyrNativeCacheRefs,
  ZephyrNativeCacheState,
} from 'zephyr-edge-contract';

// Schema version for the entire `globalThis.__ZEPHYR__` shape.
// Versioning lives at the top level only — sub-namespaces (runtime.nativeCache,
// etc.) evolve together with this version. Bumping requires a compat plan
// because last-writer-wins on shared installs.
const ZEPHYR_GLOBAL_VERSION = 1 as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function ensureZephyrGlobalNamespace(): ZephyrGlobalNamespace {
  if (!isRecord(globalThis.__ZEPHYR__)) {
    globalThis.__ZEPHYR__ = {
      version: ZEPHYR_GLOBAL_VERSION,
      runtime: {},
    };
  }

  const zephyrGlobal = globalThis.__ZEPHYR__;
  zephyrGlobal.version = ZEPHYR_GLOBAL_VERSION;
  if (!isRecord(zephyrGlobal.runtime)) {
    zephyrGlobal.runtime = {};
  }

  if (typeof window !== 'undefined') {
    window.__ZEPHYR__ = zephyrGlobal;
  }

  return zephyrGlobal;
}

export function getZephyrNativeCacheNamespace(): ZephyrNativeCacheNamespace | undefined {
  return globalThis.__ZEPHYR__?.runtime?.nativeCache;
}

export function ensureZephyrNativeCacheNamespace(): ZephyrNativeCacheNamespace {
  const zephyrGlobal = ensureZephyrGlobalNamespace();

  if (!isRecord(zephyrGlobal.runtime.nativeCache)) {
    zephyrGlobal.runtime.nativeCache = {};
  }

  return zephyrGlobal.runtime.nativeCache;
}

export function ensureZephyrNativeCacheRefs(): ZephyrNativeCacheRefs {
  const nativeCache = ensureZephyrNativeCacheNamespace();

  if (!isRecord(nativeCache.refs)) {
    nativeCache.refs = {};
  }

  return nativeCache.refs;
}

export function ensureZephyrNativeCacheState(): ZephyrNativeCacheState {
  const nativeCache = ensureZephyrNativeCacheNamespace();

  if (!isRecord(nativeCache.state)) {
    nativeCache.state = {};
  }

  return nativeCache.state;
}

export function ensureZephyrNativeCacheControls(): ZephyrNativeCacheControls {
  const nativeCache = ensureZephyrNativeCacheNamespace();

  if (!isRecord(nativeCache.controls)) {
    nativeCache.controls = {};
  }

  return nativeCache.controls;
}
