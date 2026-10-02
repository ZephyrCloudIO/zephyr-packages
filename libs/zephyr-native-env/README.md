# Zephyr Native Env

<div align="center">

[Zephyr Cloud](https://zephyr-cloud.io) | [Zephyr Docs](https://docs.zephyr-cloud.io) | [Discord](https://zephyr-cloud.io/discord) | [Twitter](https://x.com/ZephyrCloudIO) | [LinkedIn](https://www.linkedin.com/company/zephyr-cloud/)

<hr/>
<img src="https://cdn.prod.website-files.com/669061ee3adb95b628c3acda/66981c766e352fe1f57191e2_Opengraph-zephyr.png" alt="Zephyr Logo" />
</div>

Environment-specific `ZE_PUBLIC_*` values for React Native apps built with `zephyr-metro-plugin` or `zephyr-repack-plugin`, for the embedded host bundle and its Module Federation remotes.

The Zephyr bundler plugins compile every `process.env.ZE_PUBLIC_*` / `import.meta.env.ZE_PUBLIC_*` read into a synchronous lookup scoped by application UID, with the build-time value as fallback. This package loads the published `zephyr-manifest.json` files on device before host and remote code evaluates, so those lookups return the values configured for the Zephyr environment. Offline or failed loads start the app with build-time values.

## Installation

```bash
pnpm add zephyr-native-env
```

## Usage

### 1. Preload the host manifest

Start the preload at the top of the host entry file and gate the app module on it. Modules evaluated before the gate (the entry file, Suspense fallbacks, error boundaries) see build-time values.

- `applicationUid`: the UID the Zephyr plugin logs for the host build.
- `manifestUrl`: the absolute `…/zephyr-manifest.json` URL of the host's published environment, chosen per build. Omitting it disables host **and** remote overrides; a wrong UID makes the host read build-time values only.
- `timeoutMs`: per-manifest timeout (default `3000`). `preloadZephyrEnv` never rejects.

Metro (`@module-federation/metro/bootstrap`):

```js
import { withAsyncStartup } from '@module-federation/metro/bootstrap';
import { preloadZephyrEnv } from 'zephyr-native-env';

const envReady = preloadZephyrEnv({
  applicationUid: 'host.project.org',
  manifestUrl: HOST_MANIFEST_URL,
});

withAsyncStartup(
  () => envReady.then(() => require('./src/App')),
  () => require('./src/Fallback')
)();
```

Re.Pack:

```jsx
const envReady = preloadZephyrEnv({
  applicationUid: 'host.project.org',
  manifestUrl: HOST_MANIFEST_URL,
});
const App = React.lazy(() => envReady.then(() => require('./src/App')));

// `fallback={null}` keeps the native splash screen.
AppRegistry.registerComponent(appName, () => () => (
  <React.Suspense fallback={null}>
    <App />
  </React.Suspense>
));
```

### 2. Register the runtime plugin for remotes

Add the plugin to every Module Federation config with `remotes`:

```js
runtimePlugins: [require.resolve('zephyr-native-env/runtime-plugin')];
```

In ESM Re.Pack configs, use `createRequire(import.meta.url).resolve(...)`.

Before Module Federation evaluates a remote, the plugin loads the `zephyr-manifest.json` next to the remote entry. Remote UIDs come from the host manifest's `dependencies`, keyed by the consumer-side remote name; remotes it does not list keep their build-time values.

## Behavior

- Values apply at JS context start (including `ZephyrNativeCache.reloadApp()`) or a remote's first load; modules that already evaluated never change.
- Only string values with `ZE_PUBLIC_[A-Z0-9_]+` keys are applied.
- Manifests are fetched once per URL per session; failed loads are retried on the next resolution.
- A remote loaded from a different root never reuses the previous environment's values.

## License

Apache-2.0
