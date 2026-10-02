import type { ModuleFederationRuntimePlugin } from '@module-federation/runtime';
import {
  fetchManifest,
  getNativeEnvState,
  indexDependencies,
  isHttpUrl,
  setApplicationEnv,
  siblingManifestUrl,
} from './state';

type AfterResolveArgs = Parameters<
  NonNullable<ModuleFederationRuntimePlugin['afterResolve']>
>[0];

type BeforeInitArgs = Parameters<
  NonNullable<ModuleFederationRuntimePlugin['beforeInit']>
>[0];

type RemoteConfig = AfterResolveArgs['remote'];

const PLUGIN_NAME = 'zephyr-native-env-plugin';

/** Loads a remote's `zephyr-manifest.json` before MF evaluates its code. */
async function loadRemoteEnv(remote: RemoteConfig): Promise<void> {
  const state = getNativeEnvState();
  if (state.hostReady) await state.hostReady;

  const entry = 'entry' in remote ? remote.entry : undefined;
  const uid =
    state.dependencyUids.get(remote.name) ??
    (remote.alias === undefined ? undefined : state.dependencyUids.get(remote.alias));
  if (typeof uid !== 'string' || typeof entry !== 'string') return;

  const url = siblingManifestUrl(entry);
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
  state.loadedFrom.set(uid, url);
  indexDependencies(state, manifest.dependencies);
}

async function afterResolve(args: AfterResolveArgs): Promise<AfterResolveArgs> {
  try {
    await loadRemoteEnv(args.remote);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(`[zephyr-native-env] ${args.remote.name}: ${reason}`);
  }
  return args;
}

/**
 * MF runtime plugin that applies environment overrides to federated remotes. Add it to
 * every Module Federation config with `remotes`:
 *
 * ```js
 * runtimePlugins: [require.resolve('zephyr-native-env/runtime-plugin')];
 * ```
 *
 * Remote UIDs come from the host manifest loaded by `preloadZephyrEnv`; remotes it does
 * not list keep their build-time values. `beforeInit` registers a global copy so nested
 * federation instances run the hook too.
 */
export default function createZephyrNativeEnvPlugin(): ModuleFederationRuntimePlugin {
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
