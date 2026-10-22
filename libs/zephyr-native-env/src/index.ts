import {
  DEFAULT_TIMEOUT_MS,
  fetchManifest,
  getNativeEnvState,
  indexDependencies,
  isHttpUrl,
  setApplicationEnv,
  siblingManifestUrl,
  type NativeEnvState,
  type ZephyrEnvStorage,
} from './state';

export type { ZephyrEnvStorage } from './state';

export interface PreloadZephyrEnvOptions {
  /**
   * Pass `process.env.ZE_APPLICATION_UID`; the Zephyr Metro/Re.Pack plugin compiles it to
   * the host build's UID.
   */
  applicationUid: string | undefined;
  /**
   * Absolute `…/zephyr-manifest.json` URL of the host's published environment. Omitting
   * it disables host and remote overrides; bundles use build-time values.
   */
  manifestUrl?: string;
  /** Per-manifest request timeout in milliseconds (default 3000). */
  timeoutMs?: number;
  /**
   * AsyncStorage-compatible store for the last loaded values per manifest URL, used when
   * a load fails.
   */
  storage?: ZephyrEnvStorage;
}

async function loadHostEnv(
  state: NativeEnvState,
  { applicationUid, manifestUrl }: PreloadZephyrEnvOptions
): Promise<void> {
  if (manifestUrl === undefined) return;
  if (!applicationUid) {
    console.warn(
      '[zephyr-native-env] applicationUid is missing; pass process.env.ZE_APPLICATION_UID from a file built with withZephyr'
    );
    return;
  }
  if (!isHttpUrl(manifestUrl)) {
    console.warn(
      `[zephyr-native-env] ${manifestUrl}: manifestUrl must be an http(s) URL`
    );
    return;
  }

  const manifest = await fetchManifest(manifestUrl);
  if (!manifest) {
    setApplicationEnv(applicationUid, undefined);
    return;
  }

  setApplicationEnv(applicationUid, manifest.vars);
  indexDependencies(state, manifest.dependencies);
  // Warm the cache so remote manifests are usually ready when MF resolves them.
  for (const { remote_entry_url } of Object.values(manifest.dependencies)) {
    if (isHttpUrl(remote_entry_url))
      void fetchManifest(siblingManifestUrl(remote_entry_url));
  }
}

/**
 * Loads the host's published `zephyr-manifest.json` so compiled `ZE_PUBLIC_*` reads see
 * environment overrides. Gate the app module on the returned promise; code evaluated
 * earlier sees build-time values. Never rejects: a failed load applies the last values
 * persisted for that manifest URL (when `storage` is set), otherwise build-time values.
 */
export function preloadZephyrEnv(options: PreloadZephyrEnvOptions): Promise<void> {
  const state = getNativeEnvState();
  state.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  state.storage = options.storage;
  const ready = loadHostEnv(state, options).catch((error: unknown) => {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(`[zephyr-native-env] ${options.manifestUrl}: ${reason}`);
  });
  state.hostReady = ready;
  return ready;
}
