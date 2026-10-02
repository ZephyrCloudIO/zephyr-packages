import {
  DEFAULT_TIMEOUT_MS,
  fetchManifest,
  getNativeEnvState,
  indexDependencies,
  isHttpUrl,
  setApplicationEnv,
  siblingManifestUrl,
  type NativeEnvState,
} from './state';

export interface PreloadZephyrEnvOptions {
  /** Zephyr application UID of the host build (logged by the Zephyr plugin). */
  applicationUid: string;
  /**
   * Absolute `…/zephyr-manifest.json` URL of the host's published environment. Omitting
   * it disables host and remote overrides; bundles use build-time values.
   */
  manifestUrl?: string;
  /** Per-manifest request timeout in milliseconds (default 3000). */
  timeoutMs?: number;
}

async function loadHostEnv(
  state: NativeEnvState,
  { applicationUid, manifestUrl }: PreloadZephyrEnvOptions
): Promise<void> {
  if (manifestUrl === undefined) return;
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
 * earlier sees build-time values. Never rejects: offline or invalid manifests leave
 * build-time values in place.
 */
export function preloadZephyrEnv(options: PreloadZephyrEnvOptions): Promise<void> {
  const state = getNativeEnvState();
  state.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const ready = loadHostEnv(state, options).catch((error: unknown) => {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(`[zephyr-native-env] ${options.manifestUrl}: ${reason}`);
  });
  state.hostReady = ready;
  return ready;
}
